import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    console.log("📥 Fetching all refrigerator statuses from Supabase...");

    // שליפת כל המקררים ממוינים לפי שם
    const { data: fridges, error } = await supabase
      .from('fridge_status')
      .select('*')
      .order('fridge_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(fridges, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch fridges:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}