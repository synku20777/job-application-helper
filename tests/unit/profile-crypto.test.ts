import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sampleProfile } from "@job-helper/profile-schema";
import { decryptProfile, encryptProfile } from "../../apps/extension/src/storage/profileCrypto";

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto
});

describe("profile encryption", () => {
  it("round trips a candidate profile", async () => {
    const encrypted = await encryptProfile(sampleProfile, "correct horse battery staple");
    const decrypted = await decryptProfile(encrypted, "correct horse battery staple");

    expect(decrypted).toEqual(sampleProfile);
  });

  it("fails cleanly with the wrong passphrase", async () => {
    const encrypted = await encryptProfile(sampleProfile, "right passphrase");

    await expect(decryptProfile(encrypted, "wrong passphrase")).rejects.toThrow("Unable to decrypt profile data");
  });

  it("uses random salt and iv values for repeated saves", async () => {
    const first = await encryptProfile(sampleProfile, "same passphrase");
    const second = await encryptProfile(sampleProfile, "same passphrase");

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
