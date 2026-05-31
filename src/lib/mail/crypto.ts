import CryptoJS from "crypto-js";

function getKey(): string {
  const key =
    process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "Clé de chiffrement non définie (ENCRYPTION_KEY / NEXT_PUBLIC_ENCRYPTION_KEY)"
    );
  }
  return key;
}

export function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, getKey()).toString();
}

export function decryptPassword(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, getKey());
  const result = bytes.toString(CryptoJS.enc.Utf8);
  if (!result) {
    throw new Error("Le déchiffrement du mot de passe a échoué");
  }
  return result;
}
