const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// משתנים גלובליים לשמירת מצב הבוט עבור האתר
let qrCodeRaw = null;
let botStatus = 'initializing'; // 'initializing', 'qr_ready', 'ready', 'disconnected'

const whatsapp = new Client({
    authStrategy: new LocalAuth({
        clientId: "fridge-alerts-session"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ] 
    }
});

// אירועי וואטסאפ
whatsapp.on('qr', (qr) => {
    qrcode.generate(qr, { small: true }); // עדיין מדפיס בלוג לגיבוי
    qrCodeRaw = qr; // שומר את ה-QR כדי שהאתר יוכל למשוך אותו ולהציג כפתור סריקה
    botStatus = 'qr_ready';
});

whatsapp.on('ready', () => {
    console.log('WhatsApp Client is READY!');
    qrCodeRaw = null;
    botStatus = 'ready';
});

whatsapp.on('disconnected', (reason) => {
    console.log('WhatsApp was disconnected:', reason);
    qrCodeRaw = null;
    botStatus = 'disconnected';
});

// --- נתיבי API עבור ה-Dashboard של Next.js ---

// 1. בדיקת סטטוס הבוט וקבלת ה-QR הנוכחי
app.get('/api/whatsapp-status', (req, res) => {
    res.json({
        status: botStatus,
        hasQr: !!qrCodeRaw,
        qr: qrCodeRaw // האתר יקבל את זה ויהפוך לברקוד על המסך
    });
});

// 2. פקודת ניתוק (Logout) מהאתר
app.post('/api/whatsapp-logout', async (req, res) => {
    try {
        if (botStatus === 'ready') {
            await whatsapp.logout();
            botStatus = 'disconnected';
            qrCodeRaw = null;
            return res.json({ success: true, message: 'מכשיר נותק בהצלחה' });
        }
        res.status(400).json({ success: false, message: 'אין מכשיר מחובר כעת' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. הנתיב הקיים שלך לשליחת הודעות התראה מהמערכת
app.post('/send-alert', async (req, res) => {
    const { phone, message } = req.body;
    try {
        if (botStatus !== 'ready') {
            return res.status(400).json({ error: 'שרת הוואטסאפ אינו מחובר למכשיר' });
        }
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;
        await whatsapp.sendMessage(formattedPhone, message);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp Gateway running on port ${PORT}`);
});

whatsapp.initialize();