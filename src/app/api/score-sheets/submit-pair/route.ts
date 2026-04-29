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

  const segmentId = body.segmentId || "round2_semifinal";
  const pairId = body.pairId;
  const scores = body.scores || {};
  const submit = body.submit ?? true;

  if (segmentId !== "round2_semifinal") {
    return NextResponse.json({ error: "API này chỉ dùng cho vòng 2" }, { status: 400 });
  }

  if (!pairId) {
    return NextResponse.json({ error: "Thiếu pairId" }, { status: 400 });
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
    return NextResponse.json({ error: "Bạn chưa được phân công chấm vòng 2" }, { status: 403 });
  }

  const { data: pair, error: pairError } = await adminSupabase
    .from("round2_pairs")
    .select("id, segment_id, pair_no")
    .eq("id", pairId)
    .eq("segment_id", segmentId)
    .single();

  if (pairError || !pair) {
    return NextResponse.json({ error: "Không tìm thấy cặp thí sinh" }, { status: 404 });
  }

  const { data: members, error: membersError } = await adminSupabase
    .from("round2_pair_members")
    .select("contestant_id, position_no")
    .eq("pair_id", pairId)
    .order("position_no");

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length !== 2) {
    return NextResponse.json({ error: "Cặp này chưa đủ 2 thí sinh" }, { status: 400 });
  }

  const { data: criteria, error: criteriaError } = await adminSupabase
    .from("scoring_criteria")
    .select("id, title, weight, max_score, order_no")
    .eq("segment_id", segmentId)
    .order("order_no");

  if (criteriaError || !criteria?.length) {
    return NextResponse.json(
      { error: criteriaError?.message || "Không tìm thấy tiêu chí chấm" },
      { status: 400 }
    );
  }

  const resultByContestant: Record<string, number> = {};

  for (const member of members) {
    const contestantId = member.contestant_id;
    const contestantScores = scores[contestantId] || {};

    const total10 = criteria.reduce((sum: number, criterion: any) => {
      const maxScore = Number(criterion.max_score || 10);
      const rawScore = Number(contestantScores[criterion.id] || 0);
      const safeScore = Math.min(Math.max(rawScore, 0), maxScore);

      return sum + safeScore * Number(criterion.weight);
    }, 0);

    const totalScore = Math.round(total10 * 10 * 100) / 100;
    resultByContestant[contestantId] = totalScore;

    const { data: sheet, error: sheetError } = await adminSupabase
      .from("score_sheets")
      .upsert(
        {
          contestant_id: contestantId,
          judge_id: user.id,
          segment_id: segmentId,
          pair_id: pairId,
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
        { error: sheetError?.message || "Không lưu được phiếu chấm" },
        { status: 500 }
      );
    }

    const itemRows = criteria.map((criterion: any) => {
      const maxScore = Number(criterion.max_score || 10);
      const rawScore = Number(contestantScores[criterion.id] || 0);
      const safeScore = Math.min(Math.max(rawScore, 0), maxScore);

      return {
        // Các cột cũ đang bắt buộc trong bảng score_items
        score_sheet_id: sheet.id,
        criterion_key: criterion.id,
        criterion_group: criterion.title || segmentId,

        // Các cột mới dùng cho vòng 2-3
        sheet_id: sheet.id,
        criterion_id: criterion.id,

        score: safeScore,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: itemError } = await adminSupabase
      .from("score_items")
      .upsert(itemRows, {
        onConflict: "score_sheet_id,criterion_key",
      });

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    pairNo: pair.pair_no,
    totals: resultByContestant,
  });
}
