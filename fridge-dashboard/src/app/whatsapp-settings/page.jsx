'use client';
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { createClient } from '@supabase/supabase-js';

// חיבור ל-Supabase מתוך הדפדפן
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// כתובת שרת הוואטסאפ שלך ב-Render
const WHATSAPP_BOT_URL = 'https://birkat-habasar-whatsapp.onrender.com';

export default function WhatsappSettings() {
  const [botStatus, setBotStatus] = useState('loading'); // 'loading', 'ready', 'qr_ready', 'disconnected'
  const [qrCode, setQrCode] = useState(null);
  const [timerInterval, setTimerInterval] = useState(10);
  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // 1. שליפת הגדרות הטיימר מ-Supabase וסטטוס הבוט מ-Render
  useEffect(() => {
    async function fetchData() {
      // שליפת הטיימר
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('interval_minutes')
        .eq('id', 'global_config')
        .single();
      
      if (!error && data) {
        setTimerInterval(data.interval_minutes);
      }

      // שליפת סטטוס הבוט
      checkBotStatus();
    }

    fetchData();
    // בדיקת סטטוס אוטומטית כל 10 שניות כדי לרענן את ה-QR במידה ונסרק
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkBotStatus = async () => {
    try {
      const res = await fetch(`${WHATSAPP_BOT_URL}/api/whatsapp-status`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBotStatus(data.status);
      setQrCode(data.qr);
    } catch (err) {
      setBotStatus('disconnected');
    }
  };

  // 2. עדכון הטיימר בבסיס הנתונים
  const handleTimerChange = async (e) => {
    const value = parseInt(e.target.value);
    setTimerInterval(value);
    setLoadingAction(true);

    const { error } = await supabase
      .from('whatsapp_settings')
      .update({ interval_minutes: value, updated_at: new Date() })
      .eq('id', 'global_config');

    setLoadingAction(false);
    if (error) {
      showNotification('שגיאה בשמירת הטיימר', 'error');
    } else {
      showNotification(`הטיימר עודכן בהצלחה ל-${value} דקות!`, 'success');
    }
  };

  // 3. ניתוק המכשיר (Logout)
  const handleLogout = async () => {
    if (!confirm('האם אתה בטוח שברצונך לנתק את מספר הוואטסאפ מהמערכת?')) return;
    setLoadingAction(true);

    try {
      const res = await fetch(`${WHATSAPP_BOT_URL}/api/whatsapp-logout`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        showNotification('המכשיר נותק בהצלחה!', 'success');
        checkBotStatus();
      } else {
        showNotification(data.message || 'הניתוק נכשל', 'error');
      }
    } catch (err) {
      showNotification('שגיאה בתקשורת עם שרת הוואטסאפ', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const showNotification = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8" dir="rtl">
      <div className="max-w-3xl mx-auto bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        
        {/* כותרת ראשית */}
        <div className="border-b border-gray-700 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2 font-sans">
            📱 ניהול והגדרות בוט WhatsApp
          </h1>
          <p className="text-gray-400 text-sm mt-1">מערכת התראות המקררים של "ברכת הבשר"</p>
        </div>

        {/* הודעות מערכת צפות */}
        {message.text && (
          <div className={`p-4 mb-6 rounded-lg font-semibold text-center transition-all ${
            message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500' : 'bg-red-500/20 text-red-300 border border-red-500'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* צד ימין: הגדרות וטיימר */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-200 mb-2">⏱️ תדירות הודעות חוזרות בזמן תקלה</h2>
              <p className="text-gray-400 text-sm mb-3">
                אם מקרר חורג מהטמפרטורה או מתנתק, המערכת תציק ותשלח הודעה חוזרת בכל:
              </p>
              
              <select 
                value={timerInterval} 
                onChange={handleTimerChange}
                disabled={loadingAction}
                className="w-full bg-gray-700 text-white font-medium p-3 rounded-lg border border-gray-600 focus:outline-none focus:border-green-500 cursor-pointer"
              >
                <option value={5}>5 דקות (עבור סחורה רגישה במיוחד)</option>
                <option value={10}>10 דקות (מומלץ לברכת הבשר)</option>
                <option value={20}>20 דקות</option>
                <option value={30}>30 דקות</option>
                <option value={60}>שעה עגולה (60 דקות)</option>
              </select>
            </div>

            <div className="bg-gray-700/30 border border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-gray-300 mb-1 text-sm">💡 לוגיקת התראות חכמה:</h3>
              <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
                <li>בזמן זיהוי ראשוני של תקלה, הודעה נשלחת **מיד באופן מיידי**.</li>
                <li>במידה והתקלה נמשכת, הודעות תזכורת יישלחו לפי הטיימר שבחרת למעלה.</li>
                <li>ברגע שהמקרר **חוזר לטווח התקין**, תישלח הודעת הרגעה **מיד מחוץ לטיימר**.</li>
              </ul>
            </div>

            {/* כפתור ניתוק מכשיר */}
            {botStatus === 'ready' && (
              <button
                onClick={handleLogout}
                disabled={loadingAction}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold p-3 rounded-lg transition-all shadow-md flex justify-center items-center gap-2"
              >
                🛑 ניתוק מספר הוואטסאפ הנוכחי
              </button>
            )}
          </div>

          {/* צד שמאל: סטטוס חיבור וקוד QR */}
          <div className="flex flex-col items-center justify-center bg-gray-900/50 border border-gray-700 rounded-xl p-6 text-center">
            <h2 className="text-md font-semibold text-gray-300 mb-3">🖥️ סטטוס החיבור לענן</h2>
            
            {/* תצוגת סטטוס דינמית */}
            {botStatus === 'loading' && <p className="text-yellow-400 font-medium animate-pulse">מברר סטטוס מול שרת הענן...</p>}
            
            {botStatus === 'ready' && (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 bg-green-500/10 text-green-400 border border-green-500 rounded-full flex items-center justify-center text-2xl animate-bounce">
                  ✓
                </div>
                <p className="text-green-400 font-bold text-lg">המכשיר מחובר ותקין!</p>
                <p className="text-xs text-gray-400">הבוט מאובטח ומוכן לשלוח הודעות 24/7</p>
              </div>
            )}

            {botStatus === 'qr_ready' && qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <p className="text-orange-400 font-bold animate-pulse text-sm">⚠️ נדרשת סריקה: סרוק לחשבון הוואטסאפ</p>
                <div className="bg-white p-3 rounded-lg shadow-xl border-4 border-orange-500">
                  <QRCode value={qrCode} size={180} />
                </div>
                <p className="text-xs text-gray-400 max-w-[220px]">פתח וואטסאפ בטלפון ← מכשירים מקושרים ← סרוק את הקוד</p>
              </div>
            )}

            {(botStatus === 'disconnected' || (botStatus === 'qr_ready' && !qrCode)) && (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 border border-red-500 rounded-full flex items-center justify-center font-bold text-lg">
                  !
                </div>
                <p className="text-red-400 font-bold">שרת הוואטסאפ מנותק</p>
                <p className="text-xs text-gray-500 max-w-[200px]">ממתין ליצירת קוד QR חדש מהשרת בענן...</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}