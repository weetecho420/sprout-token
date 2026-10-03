// Sprout Node backend: sign-in, heartbeats and stop.
//
//   login     wallet signs a message once; we check the signature and that it owns
//             Grower Node licenses on-chain, then hand back a session token.
//   heartbeat sent every minute while the node runs; credits online time.
//   stop      credits the last stretch and marks the nodes offline (desktop: pause).
//   unpair    ends a device session.
//
// Device pairing (desktop / Android node apps):
//   pair-start    the app sends a random secret, gets a short code to show as a QR.
//   pair-approve  the wallet signs a message with that code on the phone.
//   pair-check    the app polls with its secret and collects a long-lived device session.
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
const DEVICE_SESSION_DAYS = 365;
const PAIR_MINUTES = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

type Network = { collection: string; network: string; rpc_url: string };
type License = { asset: string; name: string; network: string };

/** License collections the node network accepts (devnet beta, mainnet). */
async function getNetworks(): Promise<Network[]> {
  const { data, error } = await db.from("sprout_networks").select("collection, network, rpc_url");
  if (error) throw error;
  return (data ?? []) as Network[];
}

/** Reads Metaplex Core asset accounts on each network and keeps the ones `owner` holds in an accepted collection. */
async function verifyLicenses(networks: Network[], owner: string, assets: string[]): Promise<License[]> {
  if (!assets.length || !networks.length) return [];
  const byRpc = new Map<string, Network[]>();
  for (const n of networks) byRpc.set(n.rpc_url, [...(byRpc.get(n.rpc_url) ?? []), n]);
  const found = new Map<string, License>();
  await Promise.all(
    [...byRpc.entries()].map(async ([rpc, nets]) => {
      const res = await fetch(rpc, {
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
      (json.result?.value ?? []).forEach((acc: any, i: number) => {
        if (!acc || acc.owner !== CORE_PROGRAM) return;
        const b = Uint8Array.from(atob(acc.data[0]), (c) => c.charCodeAt(0));
        // AssetV1 layout: key(1)=1, owner(32), update authority tag(1)=2 for Collection, collection(32), name(u32 len + utf8)
        if (b.length < 70 || b[0] !== 1 || b[33] !== 2) return;
        if (bs58.encode(b.slice(1, 33)) !== owner) return;
        const coll = bs58.encode(b.slice(34, 66));
        const net = nets.find((n) => n.collection === coll);
        if (!net) return;
        const len = new DataView(b.buffer).getUint32(66, true);
        const name = new TextDecoder().decode(b.slice(70, 70 + Math.min(len, 64)));
        found.set(assets[i], { asset: assets[i], name, network: net.network });
      });
    })
  );
  return [...found.values()];
}

const publicNode = (n: any) => ({
  asset: n.asset,
  name: n.name,
  uptimeSeconds: Number(n.uptime_seconds),
  earned: Number(n.earned),
  lastSeen: n.last_seen,
});

/** Checks a signed sign-in/pairing message and the wallet's licenses. Returns licenses or an error Response. */
async function verifySigned(body: any, kind: "sign-in" | "pairing") {
  const { owner, message, signature, assets } = body ?? {};
  if (typeof owner !== "string" || typeof message !== "string" || typeof signature !== "string") {
    return { error: reply(400, { error: "Missing sign-in details." }) };
  }
  const re =
    kind === "sign-in"
      ? /^Sprout Node sign-in\n\nWallet: (\S+)\nTime: (\S+)\n/
      : /^Sprout Node pairing\n\nWallet: (\S+)\nCode: (\S+)\nTime: (\S+)\n/;
  const m = re.exec(message);
  if (!m || m[1] !== owner) return { error: reply(400, { error: "That message isn't valid." }) };
  const time = kind === "sign-in" ? m[2] : m[3];
  const age = Math.abs(Date.now() - Date.parse(time));
  if (!(age < 5 * 60 * 1000)) {
    return { error: reply(400, { error: "That signature expired. Check your phone's clock and try again." }) };
  }
  let ok = false;
  try {
    ok = nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), bs58.decode(owner));
  } catch {
    ok = false;
  }
  if (!ok) return { error: reply(401, { error: "The wallet signature didn't match." }) };

  const networks = await getNetworks();
  if (!networks.length) return { error: reply(503, { error: "The node network isn't switched on yet." }) };
  const list = Array.isArray(assets) ? assets.filter((a) => typeof a === "string").slice(0, MAX_ASSETS) : [];
  const licenses = await verifyLicenses(networks, owner, list);
  if (!licenses.length) return { error: reply(403, { error: "No Grower Node license found in this wallet." }) };

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("sprout_nodes")
    .upsert(licenses.map((l) => ({ asset: l.asset, owner, name: l.name, verified_at: now })), { onConflict: "asset" });
  if (upErr) throw upErr;
  return { owner: owner as string, licenses, code: kind === "pairing" ? m[2] : null };
}

async function newSession(owner: string, kind: "web" | "device", device: string | null = null) {
  const ms = kind === "web" ? SESSION_HOURS * 3600 * 1000 : DEVICE_SESSION_DAYS * 86400 * 1000;
  await db.from("sprout_sessions").delete().lt("expires_at", new Date().toISOString());
  const { data, error } = await db
    .from("sprout_sessions")
    .insert({ owner, kind, device, expires_at: new Date(Date.now() + ms).toISOString() })
    .select("token")
    .single();
  if (error) throw error;
  return data.token as string;
}

async function login(body: any) {
  const v = await verifySigned(body, "sign-in");
  if ("error" in v) return v.error;
  const token = await newSession(v.owner, "web");
  const { data: nodes } = await db.rpc("sprout_credit", { p_assets: v.licenses.map((l) => l.asset), p_gap: GAP_SECONDS });
  return reply(200, { token, nodes: (nodes ?? []).map(publicNode) });
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

async function pairStart(body: any) {
  const { secret, device } = body ?? {};
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 200) {
    return reply(400, { error: "Missing pairing secret." });
  }
  const name = typeof device === "string" ? device.slice(0, 40) : null;
  await db.from("sprout_pairings").delete().lt("expires_at", new Date().toISOString());
  const expires = new Date(Date.now() + PAIR_MINUTES * 60 * 1000).toISOString();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { error } = await db
      .from("sprout_pairings")
      .insert({ code, secret_hash: await sha256Hex(secret), device: name, expires_at: expires });
    if (!error) return reply(200, { code, expiresAt: expires });
  }
  throw new Error("Could not create a pairing code");
}

async function pairApprove(body: any) {
  const v = await verifySigned(body, "pairing");
  if ("error" in v) return v.error;
  const code = String(v.code || "").toUpperCase();
  const { data: p } = await db.from("sprout_pairings").select("*").eq("code", code).maybeSingle();
  if (!p || Date.parse(p.expires_at) < Date.now()) {
    return reply(410, { error: "That pairing code expired. Get a new one from the desktop app." });
  }
  if (p.token) return reply(409, { error: "That code was already used." });
  const token = await newSession(v.owner, "device", p.device);
  await db.from("sprout_pairings").update({ owner: v.owner, token }).eq("code", code);
  return reply(200, { ok: true, device: p.device, licenses: v.licenses.length });
}

async function pairCheck(body: any) {
  const { code, secret } = body ?? {};
  if (typeof code !== "string" || typeof secret !== "string") return reply(400, { error: "Missing code." });
  const { data: p } = await db.from("sprout_pairings").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!p || p.secret_hash !== (await sha256Hex(secret))) return reply(404, { status: "unknown" });
  if (!p.token) {
    if (Date.parse(p.expires_at) < Date.now()) return reply(410, { status: "expired" });
    return reply(200, { status: "pending" });
  }
  await db.from("sprout_pairings").delete().eq("code", p.code);
  return reply(200, { status: "paired", token: p.token, owner: p.owner });
}

async function sessionNodes(token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data: s } = await db.from("sprout_sessions").select("owner, expires_at, kind").eq("token", token).maybeSingle();
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  const { data: nodes } = await db.from("sprout_nodes").select("*").eq("owner", s.owner);
  return { owner: s.owner as string, kind: s.kind as string, nodes: nodes ?? [] };
}

async function heartbeat(body: any) {
  const s = await sessionNodes(body?.token);
  if (!s) return reply(401, { error: "Your node session ended. Start the node again." });

  // Licenses can be sold; re-check ownership now and then and drop any that moved.
  let assets = s.nodes.map((n: any) => n.asset);
  const stale = s.nodes.filter((n: any) => !n.verified_at || Date.now() - Date.parse(n.verified_at) > REVERIFY_MS);
  if (stale.length) {
    let still: Set<string> | null = null;
    try {
      const networks = await getNetworks();
      still = new Set((await verifyLicenses(networks, s.owner, stale.map((n: any) => n.asset))).map((l) => l.asset));
    } catch (e) {
      // A Solana RPC hiccup shouldn't knock nodes offline; check again on a later heartbeat.
      console.error("re-verify skipped", e);
    }
    const gone = still ? stale.filter((n: any) => !still!.has(n.asset)).map((n: any) => n.asset) : [];
    if (still?.size) {
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
  return reply(200, { owner: s.owner, nodes: (nodes ?? []).map(publicNode) });
}

async function stop(body: any) {
  const s = await sessionNodes(body?.token);
  if (!s) return reply(200, { nodes: [] });
  const assets = s.nodes.map((n: any) => n.asset);
  const { data: nodes } = await db.rpc("sprout_credit", { p_assets: assets, p_gap: GAP_SECONDS });
  await db.from("sprout_nodes").update({ last_seen: null }).in("asset", assets);
  if (s.kind !== "device") await db.from("sprout_sessions").delete().eq("token", body.token);
  return reply(200, { nodes: (nodes ?? []).map((n: any) => ({ ...publicNode(n), lastSeen: null })) });
}

async function unpair(body: any) {
  const s = await sessionNodes(body?.token);
  if (s) {
    const assets = s.nodes.map((n: any) => n.asset);
    await db.rpc("sprout_credit", { p_assets: assets, p_gap: GAP_SECONDS });
    await db.from("sprout_nodes").update({ last_seen: null }).in("asset", assets);
    await db.from("sprout_sessions").delete().eq("token", body.token);
  }
  return reply(200, { ok: true });
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
      case "unpair":
        return await unpair(body);
      case "pair-start":
        return await pairStart(body);
      case "pair-approve":
        return await pairApprove(body);
      case "pair-check":
        return await pairCheck(body);
      default:
        return reply(400, { error: "Unknown action." });
    }
  } catch (e) {
    console.error(e);
    return reply(500, { error: "The node server had a problem. It will retry on the next heartbeat." });
  }
});
