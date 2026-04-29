// API giám khảo xem mình được phân công chấm vòng/chặng nào.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("v_judge_assigned_segments")
    .select("*")
    .eq("judge_id", user.id)
    .eq("is_active", true)
    .order("order_no");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ segments: data || [] });
}
