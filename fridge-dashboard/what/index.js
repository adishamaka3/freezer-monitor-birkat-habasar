//const { app, BrowserWindow } = require('electron');
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// 1. הגדרת שרת ה-Express המקומי
const expressApp = express();
expressApp.use(express.json());

// 2. אתחול ה-WhatsApp Client (מותאם לענן ולמחשב מקומי)
const whatsapp = new Client({
    authStrategy: new LocalAuth({
        clientId: "fridge-alerts-session"
    }),
    puppeteer: {
        headless: true,
        // הארגומנטים האלה קריטיים כדי ש-Puppeteer יצליח לרוץ בשרת לינוקס בענן
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

// הצגת קוד ה-QR בטרמינל כשצריך להתחבר
whatsapp.on('qr', (qr) => {
    console.log('👇 סרוק את קוד ה-QR הבא עם הוואטסאפ שלך:');
    qrcode.generate(qr, { small: true });
});

// הודעה כשהחיבור לוואטסאפ הצליח
whatsapp.on('ready', () => {
    console.log('🤖 WhatsApp Gateway מוכן ומחובר לחשבון שלך!');
});

whatsapp.on('auth_failure', (msg) => {
    console.error('❌ שגיאת התחברות לוואטסאפ, נסה לסרוק שוב:', msg);
});

whatsapp.initialize();

// 3. יצירת ה-API ש-Next.js יקרא לו בזמן חריגה
expressApp.post('/send-alert', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Missing phone or message' });
    }

    try {
        // פורמט מספר הטלפון שוואטסאפ דורש (למשל: 9725XXXXXXXX@c.us)
        // הקוד הבא מוודא שאם המספר מתחיל ב-05, הוא יומר לקידומת ישראל 972
        let formattedPhone = phoneNumber.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = `972${formattedPhone.slice(1)}`;
        }
        if (!formattedPhone.endsWith('@c.us')) {
            formattedPhone = `${formattedPhone}@c.us`;
        }

        console.log(`📱 מנסה לשלוח הודעה למספר: ${formattedPhone}`);
        
        // השליחה בפועל דרך הוואטסאפ של אלקטרון
        await whatsapp.sendMessage(formattedPhone, message);
        
        console.log(`🚀 ההתראה נשלחה בוואטסאפ בהצלחה!`);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ נכשלה שליחת ההודעה מאלקטרון:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

// הפעלת השרת על פורט 4000
expressApp.listen(4000, () => {
    console.log('🔌 Electron HTTP Server רץ ומקשיב בפורט 4000');
});

// --- כאן נשאר קוד האלקטרון הרגיל שלך שמנהל את החלונות (BrowserWindow) ---
// למשל:
// app.whenReady().then(() => { ... })