const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// משתנים גלובליים לשמירת הסטטוס העדכני של הבוט
let qrCodeData = null;
let connectionStatus = 'disconnected'; // אפשרויות: disconnected, loading, ready

// הגדרת CORS כדי לאפשר לאתר ב-Vercel לגשת לנתונים
app.use(cors({
    origin: '*' // בשביל אבטחה מקסימלית בעתיד, אפשר להחליף בכתובת המדויקת של ה-Vercel שלך
}));

app.use(express.json());

// 1. אתחול הלקוח עם הגדרות אופטימיזציה מיוחדות ל-Render (מניעת חריגת 512MB RAM)
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
            '--disable-gpu'
        ]
    }
});

// ==========================================
//          ניהול אירועים של וואטסאפ
// ==========================================

// אירוע קבלת קוד QR לסריקה
client.on('qr', (qr) => {
    console.log('--- קוד QR חדש התקבל ---');
    qrCodeData = qr;
    connectionStatus = 'disconnected';
});

// אירוע טעינה לאחר סריקה
client.on('loading_screen', (percent, message) => {
    console.log(`טוען צ'אטים: ${percent}% - ${message}`);
    connectionStatus = 'loading';
});

// אירוע חיבור מוצלח
client.on('ready', () => {
    console.log('--- הבוט מחובר ומוכן לעבודה! ---');
    qrCodeData = null; // מנקים את ה-QR כי המכשיר כבר מחובר
    connectionStatus = 'ready';
});

// אירוע ניתוק מהוואטסאפ
client.on('disconnected', (reason) => {
    console.log('הבוט נתקע או נותק מהמכשיר:', reason);
    qrCodeData = null;
    connectionStatus = 'disconnected';
    // ניסיון אתחול מחדש אוטומטי במידת הצורך
    client.initialize();
});

// ==========================================
//          נתיבי ה-API עבור ה-Dashboard
// ==========================================

// נקודת קצה (Endpoint) שהאתר ב-Vercel מושך ממנה מידע בכל 10 שניות
app.get('/api/whatsapp-status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: qrCodeData
    });
});

// נקודת קצה לבדיקת תקינות כללית של השרת (Health Check)
app.get('/', (req, res) => {
    res.send('WhatsApp Gateway is up and running!');
});

// ==========================================
//          הפעלת השרת והבוט
// ==========================================

app.listen(PORT, () => {
    console.log(`WhatsApp Gateway running on port ${PORT}`);
    
    // הפעלת הבוט רק לאחר שהשרת באוויר
    console.log('מאתחל את Puppeteer והוואטסאפ...');
    client.initialize().catch(err => {
        console.error('שגיאה באתחול הבוט:', err);
    });
});