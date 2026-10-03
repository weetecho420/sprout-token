// Saves the device session on this computer. The token is encrypted with the
// operating system's keychain (Windows DPAPI / macOS Keychain) when available.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const file = () => path.join(app.getPath('userData'), 'sprout-node.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    let token = null;
    if (data.tokenEnc && safeStorage.isEncryptionAvailable()) {
      token = safeStorage.decryptString(Buffer.from(data.tokenEnc, 'base64'));
    } else if (data.token) {
      token = data.token;
    }
    return { token, owner: data.owner || null, paused: !!data.paused };
  } catch {
    return { token: null, owner: null, paused: false };
  }
}

function save({ token, owner, paused }) {
  const data = { owner: owner || null, paused: !!paused };
  if (token) {
    if (safeStorage.isEncryptionAvailable()) data.tokenEnc = safeStorage.encryptString(token).toString('base64');
    else data.token = token;
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function clear() {
  try {
    fs.unlinkSync(file());
  } catch {
    /* already gone */
  }
}

module.exports = { load, save, clear };
