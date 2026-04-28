// API lấy danh sách thí sinh mà giám khảo cần chấm trong vòng/chặng được phân công.
// GET /api/judge/scoring-queue?segmentId=round2_semifinal

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const segmentId = searchParams.get("segmentId");

  if (!segmentId) {
    return NextResponse.json({ error: "Thiếu segmentId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("v_judge_scoring_queue")
    .select("*")
    .eq("judge_id", user.id)
    .eq("segment_id", segmentId)
    .order("sbd");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contestants: data || [] });
}
