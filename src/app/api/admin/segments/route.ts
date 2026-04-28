// API phụ trợ: lấy danh sách vòng/chặng cho trang phân công.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("competition_segments")
    .select("id, round_no, name, stage_name, order_no")
    .eq("is_active", true)
    .order("order_no");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ segments: data || [] });
}
