const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Initialisation de Firebase Admin
const serviceAccount = require('./firebase-admin-sdk.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Middleware pour vérifier le token Firebase
async function verifyToken(req, res, next) {
    const idToken = req.headers.authorization;
    if (!idToken) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token invalide' });
    }
}

// Route pour tester la configuration
app.post('/api/email/test-config', verifyToken, async (req, res) => {
    const config = req.body;
    console.log('Test de configuration reçu:', {
        ...config,
        incomingServer: {
            ...config.incomingServer,
            password: '***' // Masquer le mot de passe dans les logs
        },
        outgoingServer: {
            ...config.outgoingServer,
            password: '***'
        }
    });

    try {
        // Test IMAP
        const imapConfig = {
            user: config.incomingServer.username,
            password: config.incomingServer.password,
            host: config.incomingServer.host,
            port: config.incomingServer.port,
            tls: config.incomingServer.security === 'ssl',
            tlsOptions: { rejectUnauthorized: false }
        };

        console.log('Test de connexion IMAP...');
        const imap = new Imap(imapConfig);

        // Test de la connexion SMTP
        const smtpConfig = {
            host: config.outgoingServer.host,
            port: config.outgoingServer.port,
            secure: config.outgoingServer.security === 'ssl',
            auth: {
                user: config.outgoingServer.username,
                pass: config.outgoingServer.password
            }
        };

        const transporter = nodemailer.createTransport(smtpConfig);

        // Vérifier les connexions
        await new Promise((resolve, reject) => {
            imap.once('ready', resolve);
            imap.once('error', reject);
            imap.connect();
        });

        await transporter.verify();

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur détaillée:', error);
        res.status(400).json({ error: error.message });
    }
});

// Route pour sauvegarder la configuration
app.post('/api/email/account', verifyToken, async (req, res) => {
    const config = req.body;
    const userId = req.user.uid;

    try {
        // Sauvegarder dans Firebase Firestore
        await admin.firestore().collection('emailAccounts')
            .doc(userId)
            .collection('accounts')
            .add({
                ...config,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour récupérer les emails
app.get('/api/email/messages', verifyToken, async (req, res) => {
    try {
        console.log('Tentative de récupération des emails...');

        // Récupérer la configuration du compte depuis Firestore
        const accountsSnapshot = await admin.firestore()
            .collection('emailAccounts')
            .doc(req.user.uid)
            .collection('accounts')
            .get();

        if (accountsSnapshot.empty) {
            console.log('Aucun compte email configuré');
            return res.json({ messages: [] });
        }

        const account = accountsSnapshot.docs[0].data();
        console.log('Configuration du compte trouvée:', {
            host: account.incomingServer.host,
            user: account.incomingServer.username
        });

        // Configuration IMAP
        const imapConfig = {
            user: account.incomingServer.username,
            password: account.incomingServer.password,
            host: account.incomingServer.host,
            port: account.incomingServer.port,
            tls: account.incomingServer.security === 'ssl',
            tlsOptions: { rejectUnauthorized: false }
        };

        console.log('Connexion IMAP...');
        const imap = new Imap(imapConfig);

        const messages = await new Promise((resolve, reject) => {
            const emails = [];

            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err, box) => {
                    if (err) reject(err);

                    const fetch = imap.seq.fetch('1:10', {
                        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                        struct: true
                    });

                    fetch.on('message', (msg) => {
                        const email = {};

                        msg.on('body', (stream, info) => {
                            simpleParser(stream, (err, parsed) => {
                                if (err) reject(err);
                                Object.assign(email, parsed);
                            });
                        });

                        msg.once('end', () => {
                            emails.push(email);
                        });
                    });

                    fetch.once('error', reject);
                    fetch.once('end', () => {
                        imap.end();
                        resolve(emails);
                    });
                });
            });

            imap.once('error', reject);
            imap.connect();
        });

        res.json(messages);
    } catch (error) {
        console.error('Erreur lors de la récupération des emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour envoyer un email
app.post('/api/email/send', verifyToken, async (req, res) => {
    const { accountId, to, subject, text, html } = req.body;

    try {
        // Récupérer la config du compte
        const accountDoc = await admin.firestore()
            .collection('emailAccounts')
            .doc(req.user.uid)
            .collection('accounts')
            .doc(accountId)
            .get();

        const config = accountDoc.data();

        // Configurer SMTP
        const transporter = nodemailer.createTransport({
            host: config.outgoingServer.host,
            port: config.outgoingServer.port,
            secure: config.outgoingServer.security === 'ssl',
            auth: {
                user: config.outgoingServer.username,
                pass: config.outgoingServer.password
            }
        });

        // Envoyer l'email
        await transporter.sendMail({
            from: config.emailAddress,
            to,
            subject,
            text,
            html
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 