const driveBackupFormat = "memoria-laboral-drive-v1";
const keyParts = [
  "Xqdb03AgwQFxiSaK6IMxW9SgJ8VIB6/w1UAT1+t8Y5k=",
  "vip4nvWHUS5aCY5SRIiJ2e4UTe9jqt8FpwZxqExX1Q8="
];
let keysPromise = null;

function encodeBytes(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBytes(encoded) {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((encoded.length + 3) % 4);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function getKeys() {
  if (!keysPromise) {
    keysPromise = Promise.all(keyParts.map((part) => crypto.subtle.importKey("raw", decodeBytes(part), { name: "AES-GCM" }, false, ["encrypt", "decrypt"])));
  }
  return keysPromise;
}

export async function encryptDriveBackup(payload) {
  const keys = await getKeys();
  const ivs = [];
  let encryptedData = new TextEncoder().encode(JSON.stringify(payload));
  for (const key of keys) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    encryptedData = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encryptedData));
    ivs.push(encodeBytes(iv));
  }
  return { format: driveBackupFormat, ivs, data: encodeBytes(encryptedData) };
}

export async function decryptDriveBackup(content, requireEncrypted = false) {
  const payload = JSON.parse(content);
  if (payload?.format !== driveBackupFormat) {
    const looksEncrypted = payload?.format?.startsWith("memoria-laboral-drive-") || Array.isArray(payload?.ivs) || typeof payload?.data === "string";
    if (requireEncrypted || looksEncrypted) throw new Error("El respaldo cifrado de Google Drive está dañado o no es compatible");
    return payload;
  }

  const keys = await getKeys();
  if (!Array.isArray(payload.ivs) || payload.ivs.length !== keys.length || typeof payload.data !== "string") {
    throw new Error("El respaldo cifrado de Google Drive está incompleto");
  }
  let encryptedData = decodeBytes(payload.data);
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    encryptedData = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBytes(payload.ivs[index]) }, keys[index], encryptedData));
  }
  return JSON.parse(new TextDecoder().decode(encryptedData));
}