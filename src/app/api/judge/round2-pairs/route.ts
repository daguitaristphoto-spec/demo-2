import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const segmentId = searchParams.get("segmentId") || "round2_semifinal";

  if (segmentId !== "round2_semifinal") {
    return NextResponse.json({ error: "API này chỉ dùng cho vòng 2" }, { status: 400 });
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

  const { data: pairs, error: pairsError } = await adminSupabase
    .from("round2_pairs")
    .select("id, pair_no, segment_id")
    .eq("segment_id", segmentId)
    .order("pair_no");

  if (pairsError) {
    return NextResponse.json({ error: pairsError.message }, { status: 500 });
  }

  const pairIds = (pairs || []).map((pair: any) => pair.id);

  if (pairIds.length === 0) {
    return NextResponse.json({ pairs: [] });
  }

  const { data: members, error: membersError } = await adminSupabase
    .from("round2_pair_members")
    .select("pair_id, contestant_id, position_no")
    .in("pair_id", pairIds)
    .order("position_no");

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const contestantIds = [
    ...new Set((members || []).map((member: any) => member.contestant_id)),
  ];

  const { data: contestants, error: contestantsError } = await adminSupabase
    .from("contestants")
    .select("id, sbd, full_name")
    .in("id", contestantIds);

  if (contestantsError) {
    return NextResponse.json({ error: contestantsError.message }, { status: 500 });
  }

  const contestantsById = new Map(
    (contestants || []).map((contestant: any) => [contestant.id, contestant])
  );

  const { data: scoreSheets, error: sheetsError } = await adminSupabase
    .from("score_sheets")
    .select("id, contestant_id, total_score, status")
    .eq("judge_id", user.id)
    .eq("segment_id", segmentId)
    .in("contestant_id", contestantIds);

  if (sheetsError) {
    return NextResponse.json({ error: sheetsError.message }, { status: 500 });
  }

  const sheetIds = (scoreSheets || []).map((sheet: any) => sheet.id);

  let scoreItems: any[] = [];

  if (sheetIds.length > 0) {
    const { data: itemRows, error: itemsError } = await adminSupabase
      .from("score_items")
      .select("sheet_id, criterion_id, score")
      .in("sheet_id", sheetIds);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    scoreItems = itemRows || [];
  }

  const scoreItemsBySheet = new Map<string, Record<string, number>>();

  for (const item of scoreItems) {
    if (!scoreItemsBySheet.has(item.sheet_id)) {
      scoreItemsBySheet.set(item.sheet_id, {});
    }

    scoreItemsBySheet.get(item.sheet_id)![item.criterion_id] = Number(item.score);
  }

  const existingScoresByContestant: Record<string, any> = {};

  for (const sheet of scoreSheets || []) {
    existingScoresByContestant[sheet.contestant_id] = {
      totalScore: Number(sheet.total_score ?? 0),
      status: sheet.status,
      items: scoreItemsBySheet.get(sheet.id) || {},
    };
  }

  const normalizedPairs = (pairs || []).map((pair: any) => {
    const pairMembers = (members || [])
      .filter((member: any) => member.pair_id === pair.id)
      .sort((a: any, b: any) => Number(a.position_no) - Number(b.position_no))
      .map((member: any) => {
        const contestant = contestantsById.get(member.contestant_id);

        return {
          contestant_id: member.contestant_id,
          position_no: member.position_no,
          contestant,
          existing_score: existingScoresByContestant[member.contestant_id] || null,
        };
      });

    return {
      id: pair.id,
      pair_no: pair.pair_no,
      segment_id: pair.segment_id,
      members: pairMembers,
    };
  });

  return NextResponse.json({ pairs: normalizedPairs });
}
