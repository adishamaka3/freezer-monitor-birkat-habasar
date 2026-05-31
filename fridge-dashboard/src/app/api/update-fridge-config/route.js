import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request) {
  try {
    const data = await request.json();
    const { fridge_id, fridge_name, max_temp, min_temp_limit, phone_number, update_interval_minutes } = data;

    if (!fridge_id) {
      return NextResponse.json({ error: "Missing fridge_id" }, { status: 400 });
    }

    console.log(`⚙️ Updating configuration for fridge [${fridge_id}]...`);

    // עדכון השדות בטבלה ב-Supabase
    const { error } = await supabase
      .from('fridge_status')
      .update({
        fridge_name,
        max_temp: parseFloat(max_temp),
        min_temp_limit: min_temp_limit !== '' ? parseFloat(min_temp_limit) : null,
        phone_number,
        update_interval_minutes: parseInt(update_interval_minutes)
      })
      .eq('fridge_id', fridge_id);

    if (error) throw error;

    console.log(`✅ Config updated successfully for [${fridge_id}]`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to update config:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}