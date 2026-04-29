import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await req.json();

  const segmentId = body.segmentId;
  const contestantId = body.contestantId;
  const scores = body.scores || {};
  const submit = body.submit ?? true;

  if (!segmentId) {
    return NextResponse.json({ error: "Thiếu segmentId" }, { status: 400 });
  }

  if (!contestantId) {
    return NextResponse.json({ error: "Thiếu contestantId" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "judge") {
    return NextResponse.json({ error: "Chỉ giám khảo mới được chấm" }, { status: 403 });
  }

  const { data: assignedSegment, error: assignedError } = await adminSupabase
    .from("v_judge_assigned_segments")
    .select("segment_id")
    .eq("judge_id", user.id)
    .eq("segment_id", segmentId)
    .maybeSingle();

  if (assignedError) {
    return NextResponse.json({ error: assignedError.message }, { status: 500 });
  }

  if (!assignedSegment) {
    return NextResponse.json(
      { error: "Bạn chưa được phân công chấm vòng/chặng này" },
      { status: 403 }
    );
  }

  const isRound3 =
    segmentId === "round3_stage1" ||
    segmentId === "round3_stage2" ||
    segmentId === "round3_stage3";

  if (isRound3) {
    const { data: segmentContestant, error: segmentContestantError } = await adminSupabase
      .from("segment_contestants")
      .select("segment_id, contestant_id")
      .eq("segment_id", segmentId)
      .eq("contestant_id", contestantId)
      .maybeSingle();

    if (segmentContestantError) {
      return NextResponse.json({ error: segmentContestantError.message }, { status: 500 });
    }

    if (!segmentContestant) {
      return NextResponse.json(
        { error: "Thí sinh này chưa được gán vào chặng thi đã chọn" },
        { status: 403 }
      );
    }
  }

  if (!isRound3) {
    const { data: canScore, error: canScoreError } = await adminSupabase.rpc(
      "can_judge_score_segment",
      {
        p_judge_id: profile.id,
        p_segment_id: segmentId,
        p_contestant_id: contestantId,
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
  }

  const { data: criteria, error: criteriaError } = await adminSupabase
    .from("scoring_criteria")
    .select("id, title, weight, max_score")
    .eq("segment_id", segmentId)
    .order("order_no");

  if (criteriaError || !criteria?.length) {
    return NextResponse.json(
      { error: criteriaError?.message || "Không tìm thấy tiêu chí chấm" },
      { status: 400 }
    );
  }

  const total10 = criteria.reduce((sum: number, criterion: any) => {
    const maxScore = Number(criterion.max_score || 10);
    const rawScore = Number(scores?.[criterion.id] || 0);
    const safeScore = Math.min(Math.max(rawScore, 0), maxScore);

    return sum + safeScore * Number(criterion.weight);
  }, 0);

  const totalScore = Math.round(total10 * 10 * 100) / 100;

  const { data: sheet, error: sheetError } = await adminSupabase
    .from("score_sheets")
    .upsert(
      {
        contestant_id: contestantId,
        judge_id: profile.id,
        segment_id: segmentId,
        total_score: totalScore,
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "contestant_id,judge_id,segment_id",
      }
    )
    .select("id")
    .single();

  if (sheetError || !sheet) {
    return NextResponse.json(
      { error: sheetError?.message || "Không lưu được phiếu" },
      { status: 500 }
    );
  }

  const items = criteria.map((criterion: any) => {
    const maxScore = Number(criterion.max_score || 10);
    const rawScore = Number(scores?.[criterion.id] || 0);
    const safeScore = Math.min(Math.max(rawScore, 0), maxScore);

    return {
      score_sheet_id: sheet.id,
      criterion_key: criterion.id,
      criterion_group: criterion.title || segmentId,

      sheet_id: sheet.id,
      criterion_id: criterion.id,

      score: safeScore,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: itemError } = await adminSupabase
    .from("score_items")
    .upsert(items, {
      onConflict: "score_sheet_id,criterion_key",
    });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, totalScore });
}
