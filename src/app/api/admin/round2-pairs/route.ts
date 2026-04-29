import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTopWithTie, type RankedContestant } from "@/lib/tie-breaks";

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }),
    };
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Chỉ admin mới được gán cặp vòng 2" }, { status: 403 }),
    };
  }

  return { user, profile, adminSupabase };
}

async function getRound1RankedContestants(adminSupabase: any): Promise<RankedContestant[]> {
  const { data: sheets, error: sheetsError } = await adminSupabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      total_score,
      contestant:contestants(id, sbd, full_name)
    `)
    .eq("status", "submitted")
    .or("segment_id.eq.round1_online,segment_id.is.null");

  if (sheetsError) {
    throw new Error(sheetsError.message);
  }

  const grouped = new Map<
    string,
    {
      contestantId: string;
      sbd: string;
      fullName: string;
      scores: number[];
    }
  >();

  for (const sheet of sheets || []) {
    const contestant = pickRelation((sheet as any).contestant);

    if (!contestant?.id) continue;

    if (!grouped.has(contestant.id)) {
      grouped.set(contestant.id, {
        contestantId: contestant.id,
        sbd: contestant.sbd,
        fullName: contestant.full_name,
        scores: [],
      });
    }

    grouped.get(contestant.id)?.scores.push(Number((sheet as any).total_score ?? 0));
  }

  return Array.from(grouped.values())
    .map((row) => {
      const total = row.scores.reduce((sum, score) => sum + score, 0);
      const average = row.scores.length > 0 ? total / row.scores.length : 0;

      return {
        contestantId: row.contestantId,
        sbd: row.sbd,
        fullName: row.fullName,
        score: average,
      };
    })
    .sort((a, b) => b.score - a.score || String(a.sbd).localeCompare(String(b.sbd), "vi"));
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user, adminSupabase } = auth;
  const segmentId = "round2_semifinal";

  try {
    const rankedRows = await getRound1RankedContestants(adminSupabase);

    const resolvedTop30 = await resolveTopWithTie({
      adminSupabase,
      transitionKey: "round1_to_round2",
      title: "Vote chọn thí sinh vào vòng 2",
      description:
        "Có thí sinh đồng điểm ở ngưỡng Top 30 vòng 1. Giám khảo vote để chọn thí sinh đi tiếp vào vòng 2.",
      topN: 30,
      rows: rankedRows,
      createdBy: user.id,
    });

    const topContestants = resolvedTop30.qualifiedRows.map((row) => ({
      id: row.contestantId,
      sbd: row.sbd,
      full_name: row.fullName,
      total_score: row.score,
    }));

    const { data: pairs, error: pairsError } = await adminSupabase
      .from("round2_pairs")
      .select("id, segment_id, pair_no")
      .eq("segment_id", segmentId)
      .order("pair_no");

    if (pairsError) {
      return NextResponse.json({ error: pairsError.message }, { status: 500 });
    }

    const pairIds = (pairs || []).map((pair: any) => pair.id);

    let members: any[] = [];

    if (pairIds.length > 0) {
      const { data: memberRows, error: membersError } = await adminSupabase
        .from("round2_pair_members")
        .select("pair_id, contestant_id, position_no")
        .in("pair_id", pairIds)
        .order("position_no");

      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 });
      }

      members = memberRows || [];
    }

    const contestantIds: string[] = Array.from(
      new Set<string>(members.map((member: any) => String(member.contestant_id)))
    );

    let contestantsById = new Map<string, any>();

    if (contestantIds.length > 0) {
      const { data: contestantRows, error: contestantsError } = await adminSupabase
        .from("contestants")
        .select("id, sbd, full_name")
        .in("id", contestantIds);

      if (contestantsError) {
        return NextResponse.json({ error: contestantsError.message }, { status: 500 });
      }

      contestantsById = new Map(
        (contestantRows || []).map((contestant: any) => [contestant.id, contestant])
      );
    }

    const normalizedPairs = (pairs || []).map((pair: any) => {
      const pairMembers = members
        .filter((member) => member.pair_id === pair.id)
        .sort((a, b) => Number(a.position_no) - Number(b.position_no))
        .map((member) => ({
          contestant_id: member.contestant_id,
          position_no: member.position_no,
          contestant: contestantsById.get(member.contestant_id) ?? null,
        }));

      return {
        id: pair.id,
        segment_id: pair.segment_id,
        pair_no: pair.pair_no,
        members: pairMembers,
      };
    });

    return NextResponse.json({
      topContestants,
      pairs: normalizedPairs,
      tieBreak: resolvedTop30.tieBreak,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi tải dữ liệu gán cặp vòng 2" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user, adminSupabase } = auth;
  const body = await req.json();

  const segmentId = body.segmentId || "round2_semifinal";
  const pairs = Array.isArray(body.pairs) ? body.pairs : [];

  if (segmentId !== "round2_semifinal") {
    return NextResponse.json({ error: "Chỉ hỗ trợ gán cặp cho vòng 2" }, { status: 400 });
  }

  if (pairs.length === 0) {
    return NextResponse.json({ error: "Chưa có cặp nào để lưu" }, { status: 400 });
  }

  const usedContestants = new Set<string>();

  for (const pair of pairs) {
    const contestantIds = pair.contestantIds || [];

    if (!Array.isArray(contestantIds) || contestantIds.length !== 2) {
      return NextResponse.json({ error: "Mỗi cặp phải có đúng 2 thí sinh" }, { status: 400 });
    }

    if (contestantIds[0] === contestantIds[1]) {
      return NextResponse.json({ error: "Một cặp không được chọn trùng thí sinh" }, { status: 400 });
    }

    for (const contestantId of contestantIds) {
      if (usedContestants.has(contestantId)) {
        return NextResponse.json({ error: "Một thí sinh không được nằm trong nhiều cặp" }, { status: 400 });
      }

      usedContestants.add(contestantId);
    }
  }

  const { error: deleteError } = await adminSupabase
    .from("round2_pairs")
    .delete()
    .eq("segment_id", segmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    const pairNo = Number(pair.pairNo || index + 1);
    const contestantIds = pair.contestantIds;

    const { data: insertedPair, error: pairError } = await adminSupabase
      .from("round2_pairs")
      .insert({
        segment_id: segmentId,
        pair_no: pairNo,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (pairError || !insertedPair) {
      return NextResponse.json({ error: pairError?.message || "Không tạo được cặp" }, { status: 500 });
    }

    const memberRows = contestantIds.map((contestantId: string, memberIndex: number) => ({
      pair_id: insertedPair.id,
      contestant_id: contestantId,
      position_no: memberIndex + 1,
    }));

    const { error: memberError } = await adminSupabase
      .from("round2_pair_members")
      .insert(memberRows);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
