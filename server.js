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

const db = admin.firestore();

// Middleware pour vérifier le token Firebase
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token manquant' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Erreur de vérification du token:', error);
        res.status(401).json({ message: 'Token invalide' });
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
        // Sauvegarder dans Firebase Firestore avec la syntaxe Admin
        const userRef = db.collection('users').doc(userId);
        const emailAccountsRef = userRef.collection('emailAccounts');
        await emailAccountsRef.add({
            ...config,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour lister les dossiers IMAP
app.get('/api/email/folders', verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const userRef = db.collection('users').doc(user.uid);
        const emailAccountsRef = userRef.collection('emailAccounts');
        const emailAccountsSnapshot = await emailAccountsRef.get();

        if (emailAccountsSnapshot.empty) {
            return res.json({ folders: [] });
        }

        const account = emailAccountsSnapshot.docs[0].data();
        const imapConfig = {
            user: account.emailAddress,
            password: account.password,
            host: account.imapServer,
            port: parseInt(account.imapPort),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        const folders = await new Promise((resolve, reject) => {
            const imap = new Imap(imapConfig);
            const folderList = [];

            imap.once('ready', () => {
                imap.getBoxes((err, boxes) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Parcourir récursivement les dossiers
                    function processBoxes(boxes, path = '') {
                        Object.keys(boxes).forEach(key => {
                            const box = boxes[key];
                            const fullPath = path ? `${path}${key}` : key;
                            folderList.push({
                                name: key,
                                path: fullPath,
                                flags: box.attribs || [],
                                hasChildren: !!box.children
                            });

                            if (box.children) {
                                processBoxes(box.children, `${fullPath}/`);
                            }
                        });
                    }

                    processBoxes(boxes);
                    imap.end();
                    resolve(folderList);
                });
            });

            imap.once('error', reject);
            imap.connect();
        });

        res.json({ folders });
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des dossiers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour déplacer un email vers un dossier
app.post('/api/email/move', verifyToken, async (req, res) => {
    const { messageUid, sourceFolder, targetFolder } = req.body;

    try {
        const user = req.user;
        const userRef = db.collection('users').doc(user.uid);
        const emailAccountsRef = userRef.collection('emailAccounts');
        const emailAccountsSnapshot = await emailAccountsRef.get();

        if (emailAccountsSnapshot.empty) {
            throw new Error('Aucun compte email configuré');
        }

        const account = emailAccountsSnapshot.docs[0].data();
        const imapConfig = {
            user: account.emailAddress,
            password: account.password,
            host: account.imapServer,
            port: parseInt(account.imapPort),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        await new Promise((resolve, reject) => {
            const imap = new Imap(imapConfig);

            imap.once('ready', () => {
                imap.openBox(sourceFolder, false, (err, box) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    imap.move(messageUid, targetFolder, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        imap.end();
                        resolve();
                    });
                });
            });

            imap.once('error', reject);
            imap.connect();
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur lors du déplacement de l\'email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour récupérer les emails
app.get('/api/email/messages', verifyToken, async (req, res) => {
    const folder = req.query.folder || 'INBOX';
    try {
        console.log('📥 Tentative de récupération des emails...');
        const user = req.user;
        console.log('👤 Utilisateur authentifié:', user.uid);

        // Récupérer le compte email actif de l'utilisateur depuis Firestore
        const userRef = db.collection('users').doc(user.uid);
        const emailAccountsRef = userRef.collection('emailAccounts');

        console.log('🔍 Recherche des comptes email...');
        const emailAccountsSnapshot = await emailAccountsRef.get();
        console.log('📊 Nombre de comptes trouvés:', emailAccountsSnapshot.size);

        if (emailAccountsSnapshot.empty) {
            console.log('⚠️ Aucun compte email configuré pour l\'utilisateur:', user.uid);
            return res.json({ messages: [] });
        }

        // Récupérer le premier compte email
        const accountDoc = emailAccountsSnapshot.docs[0];
        const account = accountDoc.data();

        console.log('📧 Configuration du compte:', {
            accountId: accountDoc.id,
            emailAddress: account.emailAddress,
            hasEmail: !!account.emailAddress,
            hasPassword: !!account.password,
            hasImapServer: !!account.imapServer,
            hasImapPort: !!account.imapPort,
            imapServer: account.imapServer,
            imapPort: account.imapPort
        });

        if (!account.emailAddress || !account.password || !account.imapServer || !account.imapPort) {
            const missingFields = [];
            if (!account.emailAddress) missingFields.push('emailAddress');
            if (!account.password) missingFields.push('password');
            if (!account.imapServer) missingFields.push('imapServer');
            if (!account.imapPort) missingFields.push('imapPort');

            console.error('❌ Configuration incomplète. Champs manquants:', missingFields);
            throw new Error(`Configuration du compte email incomplète. Champs manquants: ${missingFields.join(', ')}`);
        }

        // Configuration IMAP avec les bons paramètres
        const imapConfig = {
            user: account.emailAddress,
            password: account.password,
            host: account.imapServer,
            port: parseInt(account.imapPort),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            debug: console.log
        };

        console.log('🔄 Tentative de connexion IMAP...', {
            host: imapConfig.host,
            port: imapConfig.port,
            user: imapConfig.user
        });

        const messages = await new Promise((resolve, reject) => {
            const imap = new Imap(imapConfig);
            const emails = [];
            const emailPromises = [];

            imap.once('ready', () => {
                imap.openBox(folder, false, (err, box) => {
                    if (err) {
                        console.error('❌ Erreur ouverture boîte:', err);
                        reject(err);
                        return;
                    }

                    console.log('📬 Boîte ouverte, récupération des messages...');

                    // Récupérer les 20 derniers messages
                    const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 19)}:*`, {
                        bodies: '',
                        struct: true
                    });

                    fetch.on('message', (msg, seqno) => {
                        const messagePromise = new Promise((resolveMessage) => {
                            const chunks = [];
                            msg.on('body', stream => {
                                stream.on('data', chunk => {
                                    chunks.push(chunk);
                                });
                            });

                            msg.once('attributes', attrs => {
                                const email = {
                                    id: seqno,
                                    uid: attrs.uid,
                                    flags: attrs.flags || [],
                                    date: attrs.date || new Date()
                                };

                                msg.once('end', async () => {
                                    try {
                                        const buffer = Buffer.concat(chunks);
                                        const parsed = await simpleParser(buffer);

                                        const formattedEmail = {
                                            id: email.id,
                                            uid: email.uid,
                                            subject: parsed.subject || '(Sans sujet)',
                                            from: parsed.from?.text || '(Expéditeur inconnu)',
                                            to: parsed.to?.text || '(Destinataire inconnu)',
                                            date: parsed.date || email.date,
                                            body: parsed.html || parsed.textAsHtml || `<pre>${parsed.text}</pre>` || '<p>Contenu non disponible</p>',
                                            isRead: email.flags.includes('\\Seen')
                                        };

                                        console.log('✅ Message parsé avec succès:', {
                                            id: formattedEmail.id,
                                            uid: formattedEmail.uid,
                                            subject: formattedEmail.subject,
                                            from: formattedEmail.from
                                        });

                                        emails.push(formattedEmail);
                                        resolveMessage();
                                    } catch (error) {
                                        console.error('❌ Erreur parsing message:', error);
                                        resolveMessage();
                                    }
                                });
                            });
                        });
                        emailPromises.push(messagePromise);
                    });

                    fetch.once('error', err => {
                        console.error('❌ Erreur fetch:', err);
                        reject(err);
                    });

                    fetch.once('end', async () => {
                        try {
                            await Promise.all(emailPromises);
                            const validEmails = emails.filter(email => email && typeof email === 'object');
                            validEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
                            console.log(`✅ ${validEmails.length} messages récupérés et parsés`);
                            imap.end();
                            resolve(validEmails);
                        } catch (error) {
                            console.error('❌ Erreur lors du traitement final:', error);
                            reject(error);
                        }
                    });
                });
            });

            imap.once('error', err => {
                console.error('❌ Erreur IMAP:', err);
                reject(err);
            });

            imap.connect();
        });

        res.json({ messages });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des emails:', error);
        res.status(500).json({
            error: error.message,
            details: {
                code: error.code,
                source: error.source,
                type: error.type
            }
        });
    }
});

const parseEmail = async (msg) => {
    return new Promise((resolve, reject) => {
        try {
            const email = {
                id: msg.seqno,
                headers: null,
                body: '',
                attributes: null
            };

            msg.on('body', async (stream, info) => {
                try {
                    const parsed = await simpleParser(stream, {
                        skipHtmlToText: false,
                        skipTextToHtml: false,
                        skipImageLinks: false,
                        formatHtml: true,
                        encoding: 'utf-8'
                    });

                    email.headers = {
                        from: parsed.from,
                        to: parsed.to,
                        subject: parsed.subject || 'Sans sujet',
                        date: parsed.date || new Date()
                    };

                    if (parsed.html) {
                        email.body = parsed.html;
                    } else if (parsed.textAsHtml) {
                        email.body = parsed.textAsHtml;
                    } else if (parsed.text) {
                        email.body = `<pre style="white-space: pre-wrap;">${parsed.text}</pre>`;
                    } else {
                        email.body = '<p>Contenu du message non disponible</p>';
                    }

                    if (parsed.attachments && parsed.attachments.length > 0) {
                        email.attachments = parsed.attachments.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size,
                            contentId: att.contentId
                        }));
                    }
                } catch (error) {
                    console.error('❌ Erreur parsing email:', error);
                    email.headers = {
                        from: { text: 'Expéditeur inconnu' },
                        to: { text: 'Destinataire inconnu' },
                        subject: 'Message non lisible',
                        date: new Date()
                    };
                    email.body = '<p>Le contenu de ce message n\'a pas pu être lu correctement.</p>';
                }
            });

            msg.once('attributes', (attrs) => {
                email.attributes = attrs;
                email.isRead = (attrs.flags || []).includes('\\Seen');
            });

            msg.once('end', () => {
                const formattedEmail = {
                    id: email.id,
                    uid: email.attributes?.uid,
                    subject: email.headers?.subject || 'Sans sujet',
                    from: email.headers?.from?.text || 'Expéditeur inconnu',
                    to: email.headers?.to?.text || 'Destinataire inconnu',
                    date: email.headers?.date || new Date(),
                    body: email.body || '<p>Contenu non disponible</p>',
                    isRead: email.isRead || false,
                    attachments: email.attachments || []
                };
                resolve(formattedEmail);
            });

            msg.once('error', (err) => {
                console.error('❌ Erreur lors de la lecture du message:', err);
                reject(err);
            });
        } catch (error) {
            console.error('❌ Erreur générale:', error);
            reject(error);
        }
    });
};

const parseAttachments = (struct) => {
    const attachments = [];

    const processStruct = (part) => {
        if (Array.isArray(part)) {
            part.forEach(subPart => {
                if (typeof subPart === 'object' && subPart !== null) {
                    processStruct(subPart);
                }
            });
        } else if (part && typeof part === 'object') {
            if (part.disposition === 'attachment' || (part.type !== 'text' && part.type !== 'alternative' && part.type !== 'related')) {
                attachments.push({
                    filename: part.params?.name || 'pièce-jointe',
                    contentType: `${part.type}/${part.subtype}`,
                    size: part.size || 0,
                    id: part.id || null
                });
            }
        }
    };

    try {
        processStruct(struct);
    } catch (err) {
        console.warn('⚠️ Erreur lors du traitement de la structure:', err);
    }

    return attachments;
};

// Route pour envoyer un email
app.post('/api/email/send', verifyToken, async (req, res) => {
    const { accountId, to, subject, text, html } = req.body;

    try {
        // Récupérer la config du compte
        const accountDoc = await db
            .collection('users')
            .doc(req.user.uid)
            .collection('emailAccounts')
            .doc(accountId)
            .get();

        if (!accountDoc.exists) {
            throw new Error('Compte email non trouvé');
        }

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
        console.error('❌ Erreur lors de l\'envoi:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint pour l'envoi d'email
app.post('/api/send-email', verifyToken, async (req, res) => {
    try {
        const { from, to, subject, html, smtpConfig } = req.body;

        // Log détaillé de la configuration SMTP
        console.log('Configuration SMTP reçue:', {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            authUser: smtpConfig.auth.user,
            tls: smtpConfig.tls
        });

        // Vérification des paramètres requis
        if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
            throw new Error('Les identifiants SMTP sont manquants');
        }

        // Créer le transporteur SMTP avec configuration TLS et debug
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: smtpConfig.auth,
            tls: {
                rejectUnauthorized: false
            },
            debug: true,
            logger: true
        });

        // Test de connexion SMTP avec plus de détails
        console.log('🔄 Test de la connexion SMTP...');
        try {
            console.log('👤 Tentative d\'authentification avec:', smtpConfig.auth.user);
            const verifyResult = await transporter.verify();
            console.log('✅ Test de connexion réussi:', verifyResult);
        } catch (verifyError) {
            console.error('❌ Échec de l\'authentification SMTP:', {
                message: verifyError.message,
                code: verifyError.code,
                response: verifyError.response,
                command: verifyError.command
            });
            throw verifyError;
        }

        // Tentative d'envoi
        console.log('📤 Tentative d\'envoi avec les paramètres:', {
            from,
            to,
            subject,
            authUser: smtpConfig.auth.user
        });

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High'
            }
        });

        console.log('✅ Email envoyé avec succès:', {
            messageId: info.messageId,
            response: info.response
        });

        res.json({
            success: true,
            messageId: info.messageId,
            response: info.response
        });

    } catch (error) {
        console.error('❌ Erreur détaillée:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });

        res.status(500).json({
            message: 'Erreur lors de l\'envoi de l\'email',
            error: error.message,
            code: error.code,
            response: error.response
        });
    }
});

// Route pour les photos de contacts
app.get('/api/contacts/picture', (req, res) => {
    // Pour l'instant, on renvoie simplement l'image par défaut
    res.sendFile('assets/image/defaut-contact.png', { root: '.' });
});

// Route pour créer un nouveau dossier
app.post('/api/email/folders/create', verifyToken, async (req, res) => {
    const { folderName, parentFolder } = req.body;

    try {
        const user = req.user;
        const userRef = db.collection('users').doc(user.uid);
        const emailAccountsRef = userRef.collection('emailAccounts');
        const emailAccountsSnapshot = await emailAccountsRef.get();

        if (emailAccountsSnapshot.empty) {
            throw new Error('Aucun compte email configuré');
        }

        const account = emailAccountsSnapshot.docs[0].data();
        const imapConfig = {
            user: account.emailAddress,
            password: account.password,
            host: account.imapServer,
            port: parseInt(account.imapPort),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        await new Promise((resolve, reject) => {
            const imap = new Imap(imapConfig);

            imap.once('ready', () => {
                const path = parentFolder ? `${parentFolder}/${folderName}` : folderName;
                imap.addBox(path, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    imap.end();
                    resolve();
                });
            });

            imap.once('error', reject);
            imap.connect();
        });

        res.json({ success: true, message: 'Dossier créé avec succès' });
    } catch (error) {
        console.error('❌ Erreur lors de la création du dossier:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 