const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 10000;

let qrCodeData = null;
let connectionStatus = 'disconnected';

app.use(cors({ origin: '*' }));
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--js-flags="--max-old-space-size=150"'
        ]
    }
});

// חוסם טעינת תמונות וקבצי עיצוב כדי לחסוך RAM ב-Render
client.on('ready', async () => {
    console.log('--- הבוט מחובר ומוכן ב-Render! ---');
    qrCodeData = null;
    connectionStatus = 'ready';
});

client.on('qr', (qr) => {
    console.log('--- קוד QR חדש נוצר בהצלחה! ---');
    qrCodeData = qr;
    connectionStatus = 'disconnected';
});

app.get('/api/whatsapp-status', (req, res) => {
    res.json({ status: connectionStatus, qr: qrCodeData });
});

app.listen(PORT, () => {
    console.log(`WhatsApp Gateway running on port ${PORT}`);
    client.initialize().catch(err => console.error('שגיאה באתחול:', err));
});