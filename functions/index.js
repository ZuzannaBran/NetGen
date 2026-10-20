const functions = require('firebase-functions');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');

const corsHandler = cors({ origin: true });
const FEEDBACK_SUBJECT = 'NetGen feedback';

const sendgridConfig = functions.config().sendgrid || {};
const sendgridKey = sendgridConfig.key;
const toAddress = sendgridConfig.to;
const fromAddress = sendgridConfig.from;
const MAX_FEEDBACK_LENGTH = 5000;

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

        if (!sendgridKey || !toAddress || !fromAddress) {
            res.status(503).json({ error: 'Feedback delivery is not configured.' });
            return;
        }

        const { message } = req.body || {};
        if (typeof message !== 'string' || !message.trim()) {
            res.status(400).json({ error: 'Message is required.' });
            return;
        }

        const trimmedMessage = message.trim();
        if (trimmedMessage.length > MAX_FEEDBACK_LENGTH) {
            res.status(413).json({ error: 'Message is too long.' });
            return;
        }

        try {
            await sgMail.send({
                to: toAddress,
                from: fromAddress,
                subject: FEEDBACK_SUBJECT,
                text: trimmedMessage
            });

            res.status(200).json({ ok: true });
        } catch (error) {
            console.error('SendGrid error:', error);
            res.status(500).json({ error: 'Failed to send message.' });
        }
    });
});
