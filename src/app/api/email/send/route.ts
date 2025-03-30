import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import CryptoJS from "crypto-js";
import nodemailer from "nodemailer";

const decryptPassword = (encryptedPassword: string) => {
  try {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("Clé de chiffrement non définie");
    }

    const bytes = CryptoJS.AES.decrypt(
      encryptedPassword,
      process.env.ENCRYPTION_KEY
    );
    const result = bytes.toString(CryptoJS.enc.Utf8);

    if (!result) {
      throw new Error("Le déchiffrement a échoué");
    }

    return result;
  } catch (error) {
    console.error("Erreur lors du décryptage:", error);
    throw new Error("Erreur lors du décryptage du mot de passe");
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Données reçues dans l'API:", body);

    const { userId, accountId, to, subject, content } = body;
    console.log("Champs extraits:", {
      userId,
      accountId,
      to,
      subject,
      content,
    });

    if (!userId || !accountId || !to || !subject || !content) {
      console.error("Champs manquants:", {
        userId,
        accountId,
        to,
        subject,
        content,
      });
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    // Récupérer les paramètres du compte email
    const emailAccountSnap = await adminDb
      .collection("emailAccounts")
      .doc(accountId)
      .get();

    if (!emailAccountSnap.exists) {
      return NextResponse.json(
        { error: "Compte email non trouvé" },
        { status: 404 }
      );
    }

    const emailAccount = emailAccountSnap.data();
    if (!emailAccount?.email || !emailAccount?.password) {
      return NextResponse.json(
        { error: "Configuration email incomplète" },
        { status: 400 }
      );
    }

    const password = await decryptPassword(emailAccount.password);

    // Configuration du transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: emailAccount.smtpServer,
      port: emailAccount.smtpPort,
      secure: emailAccount.useSSL,
      auth: {
        user: emailAccount.email,
        pass: password,
      },
    });

    // Envoi de l'email
    await transporter.sendMail({
      from: emailAccount.email,
      to,
      subject,
      html: content,
    });

    return NextResponse.json({
      message: "Email envoyé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'envoi de l'email",
      },
      { status: 500 }
    );
  }
}
