import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import CryptoJS from "crypto-js";
import nodemailer from "nodemailer";

const decryptPassword = (encryptedPassword: string) => {
  try {
    console.log("🔐 Tentative de déchiffrement avec la clé:", process.env.NEXT_PUBLIC_ENCRYPTION_KEY ? "Clé présente" : "Clé manquante");
    
    if (!process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
      throw new Error("Clé de chiffrement non définie");
    }

    console.log("📦 Données chiffrées reçues:", encryptedPassword);
    
    const bytes = CryptoJS.AES.decrypt(
      encryptedPassword,
      process.env.NEXT_PUBLIC_ENCRYPTION_KEY
    );
    
    console.log("🔓 Résultat du déchiffrement:", bytes.toString(CryptoJS.enc.Utf8));
    
    const result = bytes.toString(CryptoJS.enc.Utf8);

    if (!result) {
      throw new Error("Le déchiffrement a échoué");
    }

    return result;
  } catch (error) {
    console.error("❌ Erreur détaillée lors du décryptage:", error);
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
    console.log("✅ Mot de passe déchiffré avec succès");

    // Configuration du transporteur SMTP
    console.log("🔧 Configuration du transporteur SMTP avec:", {
      host: emailAccount.smtpServer,
      port: emailAccount.smtpPort,
      secure: emailAccount.useSSL,
      user: emailAccount.email,
    });

    const transporter = nodemailer.createTransport({
      host: emailAccount.smtpServer,
      port: emailAccount.smtpPort,
      secure: emailAccount.useSSL,
      auth: {
        user: emailAccount.email,
        pass: password,
      },
      debug: true,
      logger: true
    });

    console.log("✅ Transporteur SMTP créé");

    // Vérifier la connexion avant d'envoyer
    try {
      await transporter.verify();
      console.log("✅ Connexion SMTP vérifiée avec succès");
    } catch (error) {
      console.error("❌ Erreur de vérification SMTP:", error);
      throw new Error(`Erreur de connexion SMTP: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }

    // Envoi de l'email
    console.log("📧 Tentative d'envoi de l'email à:", to);
    await transporter.sendMail({
      from: emailAccount.email,
      to,
      subject,
      html: content,
    });
    console.log("✅ Email envoyé avec succès");

    // Sauvegarder l'email envoyé dans Firestore
    const sentEmailData = {
      messageId: `sent_${Date.now()}`,
      from: emailAccount.email,
      to,
      subject,
      content,
      timestamp: new Date(),
      read: true,
      starred: false,
      folder: "sent",
      userId,
      selected: false,
    };

    await adminDb.collection("emails").add(sentEmailData);
    console.log("✅ Email envoyé sauvegardé dans Firestore");

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
