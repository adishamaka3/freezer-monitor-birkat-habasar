import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// פונקציית עזר לשליחת הודעה ל-WhatsApp Gateway המעודכן שלך בפורט 4000
async function sendWhatsAppMessage(phone, text) {
  try {
    // התאמה מדויקת לפורט 4000 ולנתיב /send-alert של הבוט שלך
    const gatewayUrl = 'http://localhost:4000/send-alert'; 
    
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // התאמה למפתחות שהבוט מצפה להם: phoneNumber ו-message
      body: JSON.stringify({ phoneNumber: phone, message: text })
    });
    
    if (!response.ok) throw new Error(`Gateway returned status ${response.status}`);
    console.log(`📱 WhatsApp notification sent successfully to ${phone}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp via Gateway:`, error.message);
    return false;
  }
}

export async function GET() {
  try {
    console.log("⏱️ Starting scheduled check for disconnections and temperature anomalies...");

    // 1. שליפת כל המקררים מ-Supabase
    const { data: fridges, error } = await supabase.from('fridge_status').select('*');
    if (error) throw error;

    const currentUnix = Math.floor(Date.now() / 1000);
    const ONE_HOUR_IN_SECONDS = 3600; // זמן צינון בין הודעות (שעה אחת)

    for (const fridge of fridges) {
      const lastSeenUnix = Number(fridge.last_seen || 0);
      const minutesSinceLastSeen = lastSeenUnix ? (currentUnix - lastSeenUnix) / 60 : Infinity;
      const lastAlertUnix = Number(fridge.last_alert_sent || 0);
      const isCooldownActive = (currentUnix - lastAlertUnix) < ONE_HOUR_IN_SECONDS;

      // הדפסת לוגים מפורטים לטרמינל לניתוח מהיר
      console.log(`-----------------------------------------------`);
      console.log(`🔍 סורק מקרר: ${fridge.fridge_id}`);
      console.log(`🌡️ טמפ' נוכחית: ${fridge.current_temp}°C | מקסימום: ${fridge.max_temp}°C | מינימום: ${fridge.min_temp_limit}°C`);
      console.log(`⏳ צינון (Cooldown) פעיל? ${isCooldownActive ? "כן" : "לא"} (התראה אחרונה: ${lastAlertUnix})`);

      // בדיקת ניתוק
      const maxAllowedInterval = (fridge.update_interval_minutes || 10) + 3;
      const isDisconnected = minutesSinceLastSeen > maxAllowedInterval;

      if (isDisconnected) {
        console.log(`❌ המקרר מזוהה כמנותק!`);
        if (!isCooldownActive) {
          const message = `🚨 *התראת ניתוק מקרר* 🚨\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* לא יצר קשר למעלה מ-${minutesSinceLastSeen.toFixed(0)} דקות!\nיש לבדוק חיבור לחשמל ואינטרנט בשטח.`;
          
          if (fridge.phone_number) {
            console.log(`📱 מנסה לשלוח הודעת ניתוק למספר: ${fridge.phone_number}`);
            const success = await sendWhatsAppMessage(fridge.phone_number, message);
            if (success) {
              await supabase.from('fridge_status').update({ last_alert_sent: currentUnix }).eq('fridge_id', fridge.fridge_id);
            }
          }
        } else {
          console.log(`⚠️ מדלג על הודעת ניתוק בגלל Cooldown פעיל.`);
        }
        continue; // אם הוא מנותק, מדלגים על בדיקת הטמפרטורה
      }

      // בדיקת חריגות חום וקור
      const isTempHigh = fridge.current_temp > fridge.max_temp;
      const isTempLow = fridge.min_temp_limit !== null && fridge.current_temp < fridge.min_temp_limit;

      if (isTempHigh) console.log(`🚨 חריגה זוהתה: המקרר חם מדי!`);
      if (isTempLow) console.log(`❄️ חריגה זוהתה: המקרר קר מדי!`);

      if (isTempHigh || isTempLow) {
        if (isCooldownActive) {
          console.log(`⚠️ מדלג על הודעת חריגה בגלל Cooldown פעיל.`);
          continue; 
        }

        let message = "";
        if (isTempHigh) {
          message = `🚨 *התראת חריגת חום קריטית* 🚨\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* חורג מטמפרטורת המקסימום!\n\n🌡️ טמפ' נוכחית: *${fridge.current_temp.toFixed(1)}°C*\n📈 מקסימום מותר: ${fridge.max_temp.toFixed(1)}°C\n\n⚠️ יש לבדוק שהדלת סגורה ושהמקרר תקין!`;
        } else if (isTempLow) {
          message = `❄️ *התראת סכנת קיפאון (אובר קור)* ❄️\n\nהמקרר *${fridge.fridge_name || fridge.fridge_id}* קר מדי!\n\n🌡️ טמפ' נוכחית: *${fridge.current_temp.toFixed(1)}°C*\n📉 מינימום מותר: ${fridge.min_temp_limit.toFixed(1)}°C\n\n⚠️ סכנת קפיאה של סחורה, מומלץ לבדוק את התרמוסטט.`;
        }

        if (fridge.phone_number) {
          console.log(`📱 מנסה לשלוח הודעת חריגה למספר: ${fridge.phone_number}`);
          const success = await sendWhatsAppMessage(fridge.phone_number, message);
          if (success) {
            await supabase.from('fridge_status').update({ last_alert_sent: currentUnix }).eq('fridge_id', fridge.fridge_id);
          }
        }
      } else {
        console.log(`✅ הטמפרטורה בטווח התקין. אין חריגה.`);
      }
    }

    return NextResponse.json({ success: true, message: "Scan completed successfully" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error during cron logic:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}