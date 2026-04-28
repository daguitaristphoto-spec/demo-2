import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await req.json();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "judge") {
    return NextResponse.json({ error: "Chỉ giám khảo mới được chấm" }, { status: 403 });
  }

  const { data: canScore, error: canScoreError } = await supabase.rpc(
    "can_judge_score_segment",
    {
      p_judge_id: profile.id,
      p_segment_id: body.segmentId,
      p_contestant_id: body.contestantId,
    }
  );

  if (canScoreError) {
    return NextResponse.json({ error: canScoreError.message }, { status: 500 });
  }

  if (!canScore) {
    return NextResponse.json(
      { error: "Bạn không được phân công chấm thí sinh này trong vòng/chặng này" },
      { status: 403 }
    );
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from("scoring_criteria")
    .select("id, weight")
    .eq("segment_id", body.segmentId);

  if (criteriaError || !criteria?.length) {
    return NextResponse.json({ error: "Không tìm thấy tiêu chí chấm" }, { status: 400 });
  }

  const total10 = criteria.reduce((sum, criterion) => {
    const score = Number(body.scores?.[criterion.id] || 0);
    return sum + score * Number(criterion.weight);
  }, 0);

  const totalScore = Math.round(total10 * 10 * 100) / 100;

  const { data: sheet, error: sheetError } = await supabase
    .from("score_sheets")
    .upsert(
      {
        contestant_id: body.contestantId,
        judge_id: profile.id,
        segment_id: body.segmentId,
        total_score: totalScore,
        strengths: body.strengths || null,
        weaknesses: body.weaknesses || null,
        notes: body.notes || null,
        status: body.submit ? "submitted" : "draft",
        submitted_at: body.submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contestant_id,judge_id,segment_id" }
    )
    .select("id")
    .single();

  if (sheetError || !sheet) {
    return NextResponse.json({ error: sheetError?.message || "Không lưu được phiếu" }, { status: 500 });
  }

  const items = criteria.map((criterion) => ({
    sheet_id: sheet.id,
    criterion_id: criterion.id,
    score: Number(body.scores?.[criterion.id] || 0),
  }));

  const { error: itemError } = await supabase
    .from("score_items")
    .upsert(items, { onConflict: "sheet_id,criterion_id" });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, totalScore });
}
