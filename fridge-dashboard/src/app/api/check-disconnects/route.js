import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// פונקציית עזר לשליחת הודעה לבוט הוואטסאפ שרץ ב-Render
async function sendWhatsAppMessage(phone, text) {
  try {
    // השתמש במשתנה סביבה עבור הבוט ב-Render, או שים פה ישירות את הכתובת של Render שקיבלת
    const gatewayUrl = process.env.WHATSAPP_BOT_URL || 'https://birkat-habasar-whatsapp.onrender.com/send-alert'; 
    
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // התאמה למפתחות שהבוט המשודרג ב-index.js מצפה להם (phone ו-message)
      body: JSON.stringify({ phone: phone, message: text })
    });
    
    if (!response.ok) throw new Error(`Gateway returned status ${response.status}`);
    console.log(`📱 WhatsApp notification sent successfully to ${phone}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp via Render Gateway:`, error.message);
    return false;
  }
}

export async function GET() {
  try {
    console.log("⏱️ Starting dynamic check for disconnections and temperature anomalies...");

    // 1. שליפת הגדרת הטיימר הדינמית מהטבלה החדשה שיצרנו
    const { data: globalSettings, error: settingsError } = await supabase
      .from('whatsapp_settings')
      .select('interval_minutes')
      .eq('id', 'global_config')
      .single();

    // אם אין הגדרה, נרתום 10 דקות כברירת מחדל
    const dynamicIntervalMinutes = settingsError ? 10 : (globalSettings?.interval_minutes || 10);
    const COOLDOWN_IN_SECONDS = dynamicIntervalMinutes * 60;

    console.log(`⏱️ Current alert interval configured from Dashboard: ${dynamicIntervalMinutes} minutes.`);

    // 2. שליפת כל המקררים מטבלת fridge_status
    const { data: fridges, error } = await supabase.from('fridge_status').select('*');
    if (error) throw error;

    const currentUnix = Math.floor(Date.now() / 1000);

    for (const fridge of fridges) {
      const lastSeenUnix = Number(fridge.last_seen || 0);
      const minutesSinceLastSeen = lastSeenUnix ? (currentUnix - lastSeenUnix) / 60 : Infinity;
      const lastAlertUnix = Number(fridge.last_alert_sent || 0);
      
      // בדיקה האם זמן הצינון הדינמי (5 דקות, 10 דקות וכו') עדיין פעיל
      const isCooldownActive = (currentUnix - lastAlertUnix) < COOLDOWN_IN_SECONDS;
      
      // המצב הקודם שנשמר בבסיס הנתונים ('normal', 'temp_error', 'disconnected')
      const previousStatus = fridge.last_status || 'normal';

      console.log(`-----------------------------------------------`);
      console.log(`🔍 Scanning Fridge: ${fridge.fridge_id} (${fridge.fridge_name || 'ללא שם'})`);
      console.log(`🌡️ Temp: ${fridge.current_temp}°C | Max Allowed: ${fridge.max_temp}°C | Current System Cooldown: ${isCooldownActive ? "Active" : "Inactive"}`);

      // א. בדיקת סטטוס ניתוק נוכחי
      const maxAllowedInterval = (fridge.update_interval_minutes || 10) + 3;
      const isCurrentlyDisconnected = minutesSinceLastSeen > maxAllowedInterval;

      // ב. בדיקת סטטוס חריגת טמפרטורה נוכחי
      const isTempHigh = fridge.current_temp > fridge.max_temp;
      const isTempLow = fridge.min_temp_limit !== null && fridge.current_temp < fridge.min_temp_limit;
      const isCurrentlyTempError = isTempHigh || isTempLow;

      // נקבע את הסטטוס הנוכחי המדויק של המקרר בסבב זה
      let currentStatus = 'normal';
      if (isCurrentlyDisconnected) {
        currentStatus = 'disconnected';
      } else if (isCurrentlyTempError) {
        currentStatus = 'temp_error';
      }

      // ========================================================
      // 🔥 לוגיקה חכמה 1: חזרה לשגרה (התפרצות מחוץ לטיימר!)
      // ========================================================
      if (currentStatus === 'normal' && previousStatus !== 'normal') {
        console.log(`🎉 המקרר חזר לפעולה תקינה! שולח הודעת הרגעה מיידית מחוץ לטיימר.`);
        
        let recoveryMessage = `✅ *צפירת הרגעה: המקרר חזר לשגרה* ✅\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* חזר לפעול בצורה תקינה!\n\n🌡️ טמפרטורה נוכחית: *${fridge.current_temp.toFixed(1)}°C*\n🔌 סטטוס: מחובר ומסתנכרן.`;
        
        if (fridge.phone_number) {
          await sendWhatsAppMessage(fridge.phone_number, recoveryMessage);
        }

        // עדכון בסיס הנתונים שהכל תקין, ומאפסים את הצינון כדי שיהיה מוכן לתקלה הבאה
        await supabase.from('fridge_status')
          .update({ last_status: 'normal', last_alert_sent: currentUnix })
          .eq('fridge_id', fridge.fridge_id);
          
        continue; // מסיימים את הטיפול במקרר הזה
      }

      // ========================================================
      // 🚨 לוגיקה חכמה 2: טיפול בתקלות (ניתוק או חריגת טמפרטורה)
      // ========================================================
      if (currentStatus !== 'normal') {
        
        // אם זה שינוי מצב לרעה (למשל: היה תקין ופתאום התנתק, או היה תקין ופתאום נהיה חם) - שולחים מייד!
        const isNewEmergency = previousStatus !== currentStatus;

        if (isNewEmergency || !isCooldownActive) {
          let message = "";

          if (currentStatus === 'disconnected') {
            console.log(`🚨 שליחת התראת ניתוק...`);
            message = `🚨 *התראת ניתוק מקרר* 🚨\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* לא יצר קשר למעלה מ-${minutesSinceLastSeen.toFixed(0)} דקות!\nיש לבדוק חיבור לחשמל ואינטרנט בשטח.`;
          } else if (currentStatus === 'temp_error') {
            console.log(`🚨 שליחת התראת טמפרטורה...`);
            if (isTempHigh) {
              message = `🚨 *התראת חריגת חום קריטית* 🚨\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* חורג מטמפרטורת המקסימום!\n\n🌡️ טמפ' נוכחית: *${fridge.current_temp.toFixed(1)}°C*\n📈 מקסימום מותר: ${fridge.max_temp.toFixed(1)}°C\n\n⚠️ יש לבדוק שהדלת סגורה ושהמקרר תקין!`;
            } else if (isTempLow) {
              message = `❄️ *התראת סכנת קיפאון (אובר קור)* ❄️\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* קר מדי!\n\n🌡️ טמפ' נוכחית: *${fridge.current_temp.toFixed(1)}°C*\n📉 מינימום מותר: ${fridge.min_temp_limit.toFixed(1)}°C\n\n⚠️ סכנת קפיאה של סחורה, מומלץ לבדוק את התרמוסטט.`;
            }
          }

          if (fridge.phone_number && message) {
            const success = await sendWhatsAppMessage(fridge.phone_number, message);
            if (success) {
              // מעדכנים את זמן ההתראה האחרון ואת סוג התקלה הנוכחי
              await supabase.from('fridge_status')
                .update({ last_alert_sent: currentUnix, last_status: currentStatus })
                .eq('fridge_id', fridge.fridge_id);
            }
          }
        } else {
          console.log(`⚠️ התקלה נמשכת, אך מדלג על הודעה נוספת בגלל טיימר צינון פעיל (${dynamicIntervalMinutes} דק').`);
        }
      } else {
        console.log(`✅ המקרר במצב תקין לחלוטין. לא נדרשת פעולה.`);
      }
    }

    return NextResponse.json({ success: true, message: "Smart dynamic scan completed" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error during smart cron execution:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}