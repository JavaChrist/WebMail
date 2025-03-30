import CryptoJS from "crypto-js";

export const decrypt = (encryptedText: string): string => {
  try {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("Clé de chiffrement non définie");
    }

    const bytes = CryptoJS.AES.decrypt(
      encryptedText,
      process.env.ENCRYPTION_KEY
    );
    const result = bytes.toString(CryptoJS.enc.Utf8);

    if (!result) {
      throw new Error("Le déchiffrement a échoué");
    }

    return result;
  } catch (error) {
    console.error("Erreur lors du décryptage:", error);
    throw new Error(
      `Erreur lors du décryptage: ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};
