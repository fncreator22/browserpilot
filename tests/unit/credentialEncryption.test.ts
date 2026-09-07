import {
  encryptCredential,
  decryptCredential,
  maskCredential,
  isEncryptedCredential,
} from "@/lib/security/credentialEncryption";

export async function runCredentialEncryptionTests() {
  console.log("▶ [UNIT] Running Credential Encryption & Masking Tests (Part B)...");

  // Test 1: Plaintext detection & null/empty handling
  const emptyRes = encryptCredential("");
  if (emptyRes !== null) {
    throw new Error("Expected empty string to return null");
  }
  if (decryptCredential(null) !== null) {
    throw new Error("Expected null decrypt to return null");
  }
  console.log("  ✓ Empty and null credentials handled safely");

  // Test 2: Encrypt round-trip
  const dummySecret = "dummy-test-byok-key-9876543210-abcdef";
  const encrypted = encryptCredential(dummySecret);
  if (!encrypted) {
    throw new Error("Expected encrypted to be non-null");
  }

  if (!isEncryptedCredential(encrypted)) {
    throw new Error(`Expected encrypted value to have enc:v1: prefix, got: ${encrypted.slice(0, 10)}...`);
  }
  if (encrypted.includes(dummySecret)) {
    throw new Error("Encrypted ciphertext must not contain the plaintext secret");
  }

  const decrypted = decryptCredential(encrypted);
  if (decrypted !== dummySecret) {
    throw new Error("Decrypted credential does not match original plaintext");
  }
  console.log("  ✓ AES-256-GCM authenticated encryption round-trip verified");

  // Test 3: Tampering detection (Auth tag verification failure returns null)
  const parts = encrypted.split(":");
  // parts = ['enc', 'v1', iv, authTag, ciphertext]
  // Tamper with the ciphertext
  const tamperedCiphertext = parts[4].slice(0, -2) + (parts[4].slice(-2) === "00" ? "ff" : "00");
  const tamperedEncrypted = `enc:v1:${parts[2]}:${parts[3]}:${tamperedCiphertext}`;

  const tamperedRes = decryptCredential(tamperedEncrypted);
  if (tamperedRes !== null) {
    throw new Error("Expected decryptCredential to return null when ciphertext/authTag is tampered");
  }
  console.log("  ✓ GCM authentication tag tampering detection verified");

  // Test 4: Masking tests
  const maskedEnc = maskCredential(encrypted);
  if (!maskedEnc || !maskedEnc.includes("••••••••")) {
    throw new Error(`Expected masked ciphertext to be formatted with bullet points, got: ${maskedEnc}`);
  }
  if (maskedEnc.startsWith("enc:v1")) {
    throw new Error("Masked credential must mask the decrypted secret, not the ciphertext header");
  }

  const maskedPlain = maskCredential(dummySecret);
  if (maskedPlain !== maskedEnc) {
    throw new Error("Masked credential of ciphertext should match masked credential of plaintext");
  }
  console.log("  ✓ Credential masking works consistently across encrypted and plaintext formats");

  // Test 5: Idempotency (re-encrypting already encrypted string does not double-encrypt)
  const reEncrypted = encryptCredential(encrypted);
  if (reEncrypted !== encrypted) {
    throw new Error("encryptCredential should be idempotent on already encrypted values");
  }
  console.log("  ✓ Credential encryption is idempotent");
}

if (require.main === module) {
  runCredentialEncryptionTests()
    .then(() => {
      console.log("All credential encryption tests passed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
