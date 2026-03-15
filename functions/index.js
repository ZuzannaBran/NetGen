const functions = require('firebase-functions');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');

const corsHandler = cors({ origin: true });
const FEEDBACK_SUBJECT = 'NetGen feedback';

const sendgridConfig = functions.config().sendgrid || {};
const sendgridKey = sendgridConfig.key;
const toAddress = sendgridConfig.to || 'baran_zuzanna@outlook.com';
const fromAddress = sendgridConfig.from || toAddress;

if (sendgridKey) {
    sgMail.setApiKey(sendgridKey);
}

exports.sendFeedback = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.set('Allow', 'POST');
            res.status(405).send('Method Not Allowed');
            return;
        }

        if (!sendgridKey) {
            res.status(500).json({ error: 'SendGrid key is not configured.' });
            return;
        }

        const { message } = req.body || {};
        if (typeof message !== 'string' || !message.trim()) {
            res.status(400).json({ error: 'Message is required.' });
            return;
        }

        const trimmedMessage = message.trim();

        try {
            await sgMail.send({
                to: toAddress,
                from: fromAddress,
                subject: FEEDBACK_SUBJECT,
                text: trimmedMessage,
                mailSettings: {
                    sandboxMode: {
                        enable: false
                    }
                }
            });

            res.status(200).json({ ok: true });
        } catch (error) {
            console.error('SendGrid error:', error);
            res.status(500).json({ error: 'Failed to send message.' });
        }
    });
});
