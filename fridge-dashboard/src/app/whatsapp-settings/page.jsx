'use client';

import { useState, useEffect } from 'react';

// הכתובת המדויקת של השרת שלך ב-Render
const WHATSAPP_BOT_URL = 'https://freezer-monitor-birkat-habasar-whatsapp.onrender.com';

export default function WhatsappSettings() {
    const [status, setStatus] = useState('loading'); // loading, disconnected, ready
    const [qrCode, setQrCode] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // פונקציה שמושכת את הסטטוס מהשרת ב-Render
        const checkStatus = async () => {
            try {
                const res = await fetch(`${WHATSAPP_BOT_URL}/api/whatsapp-status`);
                if (!res.ok) throw new Error('שרת הוואטסאפ לא מגיב');
                
                const data = await res.json();
                setStatus(data.status);
                setQrCode(data.qr);
                setError(null);
            } catch (err) {
                console.error('Error fetching WhatsApp status:', err);
                setError('לא מצליח להתחבר לשרת הבוט. ודא ש-Render במצב Live.');
            }
        };

        // מריץ בדיקה מיד כשנכנסים לדף
        checkStatus();

        // בודק סטטוס אוטומטית בכל 5 שניות כדי לזהות מתי המשתמש סרק
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center', direction: 'rtl' }}>
            <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>⚙️ חיבור וואטסאפ - ברכת הבשר</h1>
            <p style={{ color: '#666', marginBottom: '30px' }}>נהל את חיבור מערכת התראות המקררים למספר הוואטסאפ של העסק</p>

            <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '450px',
                margin: '0 auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                backgroundColor: '#fff'
            }}>
                {error && (
                    <div style={{ color: '#d32f2f', backgroundColor: '#ffebee', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                        {error}
                    </div>
                )}

                {/* מצב טעינה ראשונית */}
                {status === 'loading' && !error && (
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>בודק סטטוס חיבור...</div>
                        <p style={{ color: '#888' }}>מתחבר לשרת הבוט ב-Render, אנא המתן קטנה...</p>
                    </div>
                )}

                {/* מצב מנותק - מציג את ה-QR בצורה ויזואלית */}
                {status === 'disconnected' && !error && (
                    <div>
                        <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#ffebee', color: '#c62828', fontWeight: 'bold', marginBottom: '20px' }}>
                            🔴 מנותק
                        </div>
                        
                        <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>פתח את הוואטסאפ בטלפון, כנס ל'מכשירים מקושרים' וסרוק את הקוד:</p>

                        {qrCode ? (
                            <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
                                {/* יצירת תמונת QR יציבה מתוך הטקסט שהשרת מחזיר */}
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`} 
                                    alt="WhatsApp QR Code"
                                    style={{ border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: '8px' }}
                                />
                            </div>
                        ) : (
                            <div style={{ padding: '40px 0' }}>
                                <div style={{ inlineSize: '40px', blockSize: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4caf50', borderRadius: '50%', margin: '0 auto 15px auto', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#777' }}>מייצר קוד QR חדש בדפדפן השרת... תכף מופיע</p>
                                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            </div>
                        )}
                    </div>
                )}

                {/* מצב מחובר בהצלחה */}
                {status === 'ready' && !error && (
                    <div style={{ padding: '20px 0' }}>
                        <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold', marginBottom: '20px' }}>
                            🟢 מחובר לענן
                        </div>
                        <div style={{ fontSize: '64px', marginBottom: '15px' }}>✅</div>
                        <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>המערכת מחוברת בהצלחה!</h3>
                        <p style={{ color: '#666', fontSize: '14px' }}>הבוט מאזין כעת למקררים וישלח התראות וואטסאפ אוטומטיות בזמן אמת לגבי טמפרטורות חריגות.</p>
                    </div>
                )}
            </div>
        </div>
    );
}