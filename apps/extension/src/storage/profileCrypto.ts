import type { CandidateProfile } from "@job-helper/profile-schema";

export type ProfileKdfMetadata = {
  name: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
};

export type EncryptedProfilePayload = {
  version: 1;
  ciphertext: string;
  salt: string;
  iv: string;
  kdf: ProfileKdfMetadata;
};

export const profileKdf: ProfileKdfMetadata = {
  name: "PBKDF2",
  hash: "SHA-256",
  iterations: 100000
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function importPassphraseKey(passphrase: string): Promise<CryptoKey> {
  if (!passphrase.trim()) throw new Error("Passphrase is required.");
  return crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
}

async function deriveAesKey(passphraseKey: CryptoKey, salt: Uint8Array, kdf: ProfileKdfMetadata): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bufferSource(salt),
      iterations: kdf.iterations,
      hash: kdf.hash
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptProfileWithKey(profile: CandidateProfile, passphraseKey: CryptoKey): Promise<EncryptedProfilePayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(passphraseKey, salt, profileKdf);
  const plaintext = textEncoder.encode(JSON.stringify(profile));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bufferSource(iv) }, aesKey, bufferSource(plaintext))
  );

  return {
    version: 1,
    ciphertext: bytesToBase64(ciphertext),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    kdf: profileKdf
  };
}

export async function decryptProfileWithKey(payload: EncryptedProfilePayload, passphraseKey: CryptoKey): Promise<CandidateProfile> {
  try {
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const aesKey = await deriveAesKey(passphraseKey, salt, payload.kdf);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bufferSource(iv) },
      aesKey,
      bufferSource(base64ToBytes(payload.ciphertext))
    );
    return JSON.parse(textDecoder.decode(plaintext)) as CandidateProfile;
  } catch {
    throw new Error("Unable to decrypt profile data. Check the passphrase.");
  }
}

export async function encryptProfile(profile: CandidateProfile, passphrase: string): Promise<EncryptedProfilePayload> {
  return encryptProfileWithKey(profile, await importPassphraseKey(passphrase));
}

export async function decryptProfile(payload: EncryptedProfilePayload, passphrase: string): Promise<CandidateProfile> {
  return decryptProfileWithKey(payload, await importPassphraseKey(passphrase));
}
