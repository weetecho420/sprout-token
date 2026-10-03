// Calls to the Sprout Node backend (the same server the website uses).
const { SUPABASE_URL, SUPABASE_KEY } = require('./config');

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
    this.retry = !status || status >= 500;
  }
}

async function call(action, body = {}) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/sprout-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError("Can't reach the Sprout network. Check your internet connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || `Server error (${res.status})`, res.status, json);
  return json;
}

module.exports = {
  ApiError,
  pairStart: (secret, device) => call('pair-start', { secret, device }),
  pairCheck: (code, secret) => call('pair-check', { code, secret }),
  heartbeat: (token) => call('heartbeat', { token }),
  pause: (token) => call('stop', { token }),
  unpair: (token) => call('unpair', { token }),
};
