import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// אתחול החיבור ל-Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request) {
  try {
    const body = await request.json();
    
    // גמישות בקבלת הנתונים: תמיכה גם ב-hub_id וגם ב-espId / espid
    const hubId = body.hub_id || body.espId || body.espid;
    const readings = body.readings;

    // ולידציה בסיסית על מבנה הבקשה
    if (!hubId || !Array.isArray(readings)) {
      console.error("❌ Invalid request structure:", body);
      return NextResponse.json({ error: "Missing hub_id or readings array" }, { status: 400 });
    }

    console.log(`ℹ️ Received update from Hub [${hubId}] for ${readings.length} refrigerators...`);
    const currentUnixTime = Math.floor(Date.now() / 1000);

    // לולאה רצה על כל המקררים שנשלחו בדיווח הנוכחי
    for (const reading of readings) {
      // תמיכה כפולה בשמות המפתחות (fridge_id או id, temperature או temp)
      const fridgeId = reading.fridge_id || reading.id;
      const temperature = reading.temperature !== undefined ? reading.temperature : reading.temp;

      if (!fridgeId || temperature === undefined) {
        console.warn(`⚠️ Skipping invalid reading inside hub [${hubId}]:`, reading);
        continue;
      }

      console.log(`🌡️ Processing [${fridgeId}]: ${temperature}°C`);

      // 1. עדכון הסטטוס הנוכחי בטבלת fridge_status
      const { error: statusError } = await supabase
        .from('fridge_status')
        .update({
          current_temp: parseFloat(temperature),
          last_seen: currentUnixTime
        })
        .eq('fridge_id', fridgeId);

      if (statusError) {
        console.error(`❌ Error updating status for ${fridgeId}:`, statusError.message);
        continue; // ממשיך למקרר הבא גם אם אחד נכשל
      }

      // 2. הזרקת שורת לוג חדשה לטבלת fridge_logs עבור הגרף
      const { error: logError } = await supabase
        .from('fridge_logs')
        .insert({
          fridge_id: fridgeId,
          temperature: parseFloat(temperature)
        });

      if (logError) {
        console.error(`❌ Error inserting log for ${fridgeId}:`, logError.message);
      } else {
        console.log(`✅ Status and History Log updated for [${fridgeId}]`);
      }
    }

    return NextResponse.json({ success: true, message: "Data processed successfully" }, { status: 200 });

  } catch (error) {
    console.error("💥 Critical error in update-temp API:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}