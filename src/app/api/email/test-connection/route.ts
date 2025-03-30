import { NextResponse } from "next/server";
import { createTransport } from "nodemailer";

export const runtime = "nodejs"; // Forcer l'utilisation de Node.js au lieu de Edge

export async function POST(request: Request) {
  try {
    const { host, port, secure, user, pass } = await request.json();

    // Configuration pour SMTP
    const config = {
      host,
      port: Number(port),
      secure: Boolean(secure),
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false, // Pour éviter les erreurs de certificat en développement
      },
    };

    // Test de la connexion SMTP
    const transporter = createTransport(config);

    try {
      await transporter.verify();
      return NextResponse.json({
        success: true,
        message: "Connexion au serveur de messagerie réussie",
      });
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Erreur de connexion : ${error.message}`
          : "Erreur de connexion au serveur de messagerie"
      );
    } finally {
      transporter.close();
    }
  } catch (error) {
    console.error("Erreur lors du test de connexion:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur de connexion au serveur de messagerie";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
