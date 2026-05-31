import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request) {
  try {
    // שליפת ה-fridge_id מתוך הפרמטרים של ה-URL (למשל ?fridge_id=fridge_1_1)
    const { searchParams } = new URL(request.url);
    const fridgeId = searchParams.get('fridge_id');

    if (!fridgeId) {
      return NextResponse.json({ error: "Missing fridge_id parameter" }, { status: 400 });
    }

    // חישוב הזמן של לפני 24 שעות
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // שליפת הלוגים מטבלת fridge_logs (או temperature_history - שנה את השם אם אצלך הוא שונה)
    const { data: logs, error } = await supabase
      .from('fridge_logs') 
      .select('temperature, created_at')
      .eq('fridge_id', fridgeId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: true }); // מיון מהישן לחדיש כדי שהגרף יזרום משמאל לימין

    if (error) throw error;

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch fridge logs:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}