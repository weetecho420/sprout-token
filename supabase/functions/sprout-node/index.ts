// Sprout Node backend: sign-in, heartbeats and stop.
//
//   login     wallet signs a message once; we check the signature and that it owns
//             Grower Node licenses on-chain, then hand back a session token.
//   heartbeat sent every minute while the node runs; credits online time.
//   stop      credits the last stretch and marks the nodes offline.
//
// Auth is the wallet signature + session token, so verify_jwt is off.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

const CORE_PROGRAM = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const GAP_SECONDS = 180; // miss 3 minutes of heartbeats and the node counts as offline
const REVERIFY_MS = 10 * 60 * 1000; // re-check on-chain ownership every 10 minutes
const SESSION_HOURS = 24;
const MAX_ASSETS = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Config = { collection: string | null; rpc_url: string };
type License = { asset: string; name: string };

async function getConfig(): Promise<Config> {
  const { data, error } = await db.from("sprout_config").select("collection, rpc_url").eq("id", 1).single();
  if (error) throw error;
  return data as Config;
}

/** Reads Metaplex Core asset accounts and keeps the ones `owner` holds in our collection. */
async function verifyLicenses(cfg: Config, owner: string, assets: string[]): Promise<License[]> {
  if (!assets.length) return [];
  const res = await fetch(cfg.rpc_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getMultipleAccounts",
      params: [assets, { encoding: "base64", commitment: "confirmed" }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const out: License[] = [];
  (json.result?.value ?? []).forEach((acc: any, i: number) => {
    if (!acc || acc.owner !== CORE_PROGRAM) return;
    const b = Uint8Array.from(atob(acc.data[0]), (c) => c.charCodeAt(0));
    // AssetV1 layout: key(1)=1, owner(32), update authority tag(1)=2 for Collection, collection(32), name(u32 len + utf8)
    if (b.length < 70 || b[0] !== 1 || b[33] !== 2) return;
    if (bs58.encode(b.slice(1, 33)) !== owner) return;
    if (bs58.encode(b.slice(34, 66)) !== cfg.collection) return;
    const len = new DataView(b.buffer).getUint32(66, true);
    const name = new TextDecoder().decode(b.slice(70, 70 + Math.min(len, 64)));
    out.push({ asset: assets[i], name });
  });
  return out;
}

const publicNode = (n: any) => ({
  asset: n.asset,
  name: n.name,
  uptimeSeconds: Number(n.uptime_seconds),
  earned: Number(n.earned),
  lastSeen: n.last_seen,
});

async function login(body: any) {
  const { owner, message, signature, assets } = body ?? {};
  if (typeof owner !== "string" || typeof message !== "string" || typeof signature !== "string") {
    return reply(400, { error: "Missing sign-in details." });
  }
  const m = /^Sprout Node sign-in\n\nWallet: (\S+)\nTime: (\S+)\n/.exec(message);
  if (!m || m[1] !== owner) return reply(400, { error: "That sign-in message isn't valid." });
  const age = Math.abs(Date.now() - Date.parse(m[2]));
  if (!(age < 5 * 60 * 1000)) return reply(400, { error: "That sign-in expired. Check your phone's clock and try again." });

  let ok = false;
  try {
    ok = nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), bs58.decode(owner));
  } catch {
    ok = false;
  }
  if (!ok) return reply(401, { error: "The wallet signature didn't match." });

  const cfg = await getConfig();
  if (!cfg.collection) return reply(503, { error: "The node network isn't switched on yet." });
  const list = Array.isArray(assets) ? assets.filter((a) => typeof a === "string").slice(0, MAX_ASSETS) : [];
  const licenses = await verifyLicenses(cfg, owner, list);
  if (!licenses.length) return reply(403, { error: "No Grower Node license found in this wallet." });

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("sprout_nodes")
    .upsert(licenses.map((l) => ({ asset: l.asset, owner, name: l.name, verified_at: now })), { onConflict: "asset" });
  if (upErr) throw upErr;

  await db.from("sprout_sessions").delete().lt("expires_at", now);
  const { data: session, error: sErr } = await db
    .from("sprout_sessions")
    .insert({ owner, expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString() })
    .select("token")
    .single();
  if (sErr) throw sErr;

  const { data: nodes } = await db.rpc("sprout_credit", { p_assets: licenses.map((l) => l.asset), p_gap: GAP_SECONDS });
  return reply(200, { token: session.token, nodes: (nodes ?? []).map(publicNode) });
}

async function sessionNodes(token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data: s } = await db.from("sprout_sessions").select("owner, expires_at").eq("token", token).maybeSingle();
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  const { data: nodes } = await db.from("sprout_nodes").select("*").eq("owner", s.owner);
  return { owner: s.owner as string, nodes: nodes ?? [] };
}

async function heartbeat(body: any) {
  const s = await sessionNodes(body?.token);
  if (!s) return reply(401, { error: "Your node session ended. Start the node again." });

  // Licenses can be sold; re-check ownership now and then and drop any that moved.
  let assets = s.nodes.map((n: any) => n.asset);
  const stale = s.nodes.filter((n: any) => !n.verified_at || Date.now() - Date.parse(n.verified_at) > REVERIFY_MS);
  if (stale.length) {
    const cfg = await getConfig();
    const still = new Set((await verifyLicenses(cfg, s.owner, stale.map((n: any) => n.asset))).map((l) => l.asset));
    const gone = stale.filter((n: any) => !still.has(n.asset)).map((n: any) => n.asset);
    if (still.size) {
      await db.from("sprout_nodes").update({ verified_at: new Date().toISOString() }).in("asset", [...still]);
    }
    if (gone.length) {
      await db.from("sprout_nodes").update({ last_seen: null }).in("asset", gone);
      assets = assets.filter((a: string) => !gone.includes(a));
    }
  }
  if (!assets.length) return reply(403, { error: "This wallet no longer holds a Grower Node license." });

  const { data: nodes, error } = await db.rpc("sprout_credit", { p_assets: assets, p_gap: GAP_SECONDS });
  if (error) throw error;
  return reply(200, { nodes: (nodes ?? []).map(publicNode) });
}

async function stop(body: any) {
  const s = await sessionNodes(body?.token);
  if (!s) return reply(200, { nodes: [] });
  const assets = s.nodes.map((n: any) => n.asset);
  const { data: nodes } = await db.rpc("sprout_credit", { p_assets: assets, p_gap: GAP_SECONDS });
  await db.from("sprout_nodes").update({ last_seen: null }).in("asset", assets);
  await db.from("sprout_sessions").delete().eq("token", body.token);
  return reply(200, { nodes: (nodes ?? []).map((n: any) => ({ ...publicNode(n), lastSeen: null })) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    const body = await req.json().catch(() => null);
    switch (body?.action) {
      case "login":
        return await login(body);
      case "heartbeat":
        return await heartbeat(body);
      case "stop":
        return await stop(body);
      default:
        return reply(400, { error: "Unknown action." });
    }
  } catch (e) {
    console.error(e);
    return reply(500, { error: "The node server had a problem. It will retry on the next heartbeat." });
  }
});
