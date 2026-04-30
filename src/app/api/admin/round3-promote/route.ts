import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTopWithTie, type RankedContestant } from "@/lib/tie-breaks";

const REQUIRED_JUDGE_COUNT = 5;

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireAdmin() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Chỉ admin mới được thao tác" },
        { status: 403 }
      ),
    };
  }

  return { user, profile, adminSupabase };
}

async function parseRequest(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return req.json();
  }

  const formData = await req.formData();

  return {
    action: formData.get("action"),
    topN: Number(formData.get("topN") || 0),
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortRankedRows(rows: RankedContestant[]) {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    return String(a.sbd || "").localeCompare(String(b.sbd || ""), "vi", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

async function getContestantsByIds(
  adminSupabase: any,
  contestantIds: string[]
) {
  if (contestantIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await adminSupabase
    .from("contestants")
    .select("id, sbd, full_name")
    .in("id", contestantIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map<string, any>(
    (data || []).map((contestant: any) => [
      String(contestant.id),
      contestant,
    ])
  );
}

async function getRound2ContestantIds(adminSupabase: any): Promise<string[]> {
  const { data: pairs, error: pairsError } = await adminSupabase
    .from("round2_pairs")
    .select("id")
    .eq("segment_id", "round2_semifinal");

  if (pairsError) {
    throw new Error(pairsError.message);
  }

  const pairIds: string[] = (pairs || []).map((pair: any) => String(pair.id));

  if (pairIds.length === 0) {
    throw new Error("Chưa có dữ liệu ghép cặp vòng 2.");
  }

  const { data: members, error: membersError } = await adminSupabase
    .from("round2_pair_members")
    .select("contestant_id")
    .in("pair_id", pairIds);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const contestantIds: string[] = Array.from(
    new Set<string>(
      (members || []).map((member: any) => String(member.contestant_id))
    )
  );

  if (contestantIds.length === 0) {
    throw new Error("Chưa có thí sinh trong các cặp vòng 2.");
  }

  return contestantIds;
}

async function getSegmentContestantIds(
  adminSupabase: any,
  segmentIds: string[]
): Promise<Map<string, Set<string>>> {
  const { data, error } = await adminSupabase
    .from("segment_contestants")
    .select("segment_id, contestant_id")
    .in("segment_id", segmentIds);

  if (error) {
    throw new Error(error.message);
  }

  const bySegment = new Map<string, Set<string>>();

  for (const segmentId of segmentIds) {
    bySegment.set(segmentId, new Set<string>());
  }

  for (const row of data || []) {
    const segmentId = String((row as any).segment_id);
    const contestantId = String((row as any).contestant_id);

    if (!bySegment.has(segmentId)) {
      bySegment.set(segmentId, new Set<string>());
    }

    bySegment.get(segmentId)?.add(contestantId);
  }

  return bySegment;
}

function formatMissingList(
  missingRows: {
    sbd: string;
    fullName: string;
    segmentLabel: string;
    count: number;
  }[]
) {
  return missingRows
    .slice(0, 12)
    .map(
      (row) =>
        `${row.sbd || "-"} - ${row.fullName || "Không rõ tên"} (${row.segmentLabel}: ${
          row.count
        }/${REQUIRED_JUDGE_COUNT})`
    )
    .join("; ");
}

async function getRound2RankedContestants(
  adminSupabase: any
): Promise<RankedContestant[]> {
  const expectedContestantIds = await getRound2ContestantIds(adminSupabase);
  const contestantsById = await getContestantsByIds(
    adminSupabase,
    expectedContestantIds
  );

  const { data: sheets, error } = await adminSupabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      judge_id,
      total_score,
      contestant:contestants(id, sbd, full_name)
    `)
    .eq("segment_id", "round2_semifinal")
    .eq("status", "submitted")
    .in("contestant_id", expectedContestantIds);

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<
    string,
    {
      contestantId: string;
      sbd: string;
      fullName: string;
      scores: number[];
      judgeIds: Set<string>;
    }
  >();

  for (const contestantId of expectedContestantIds) {
    const contestant = contestantsById.get(String(contestantId));

    grouped.set(String(contestantId), {
      contestantId: String(contestantId),
      sbd: contestant?.sbd || "",
      fullName: contestant?.full_name || "",
      scores: [],
      judgeIds: new Set<string>(),
    });
  }

  for (const sheet of sheets || []) {
    const contestant = pickRelation((sheet as any).contestant);
    const contestantId = String((sheet as any).contestant_id);

    if (!grouped.has(contestantId)) {
      grouped.set(contestantId, {
        contestantId,
        sbd: contestant?.sbd || "",
        fullName: contestant?.full_name || "",
        scores: [],
        judgeIds: new Set<string>(),
      });
    }

    const current = grouped.get(contestantId)!;

    current.scores.push(Number((sheet as any).total_score ?? 0));

    if ((sheet as any).judge_id) {
      current.judgeIds.add(String((sheet as any).judge_id));
    }
  }

  const missingRows = Array.from(grouped.values())
    .filter((row) => row.judgeIds.size < REQUIRED_JUDGE_COUNT)
    .map((row) => ({
      sbd: row.sbd,
      fullName: row.fullName,
      segmentLabel: "Vòng 2",
      count: row.judgeIds.size,
    }));

  if (missingRows.length > 0) {
    throw new Error(
      `Chưa thể lấy Top 10 vào vòng 3 vì còn thí sinh chưa đủ ${REQUIRED_JUDGE_COUNT}/5 phiếu chấm vòng 2: ${formatMissingList(
        missingRows
      )}${missingRows.length > 12 ? "; ..." : ""}`
    );
  }

  return sortRankedRows(
    Array.from(grouped.values()).map((row) => ({
      contestantId: row.contestantId,
      sbd: row.sbd,
      fullName: row.fullName,
      score: average(row.scores) ?? 0,
    }))
  );
}

async function getStage12RankedContestants(
  adminSupabase: any
): Promise<RankedContestant[]> {
  const stageIds = ["round3_stage1", "round3_stage2"];
  const bySegment = await getSegmentContestantIds(adminSupabase, stageIds);

  const stage1Ids: string[] = Array.from(
    bySegment.get("round3_stage1") ?? new Set<string>()
  );

  const stage2Ids: string[] = Array.from(
    bySegment.get("round3_stage2") ?? new Set<string>()
  );

  const expectedContestantIds: string[] = Array.from(
    new Set<string>([...stage1Ids, ...stage2Ids].map(String))
  );

  if (expectedContestantIds.length === 0) {
    throw new Error("Chưa có danh sách thí sinh vòng 3 chặng 1 và chặng 2.");
  }

  const contestantsById = await getContestantsByIds(
    adminSupabase,
    expectedContestantIds
  );

  const { data: sheets, error } = await adminSupabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      judge_id,
      segment_id,
      total_score,
      contestant:contestants(id, sbd, full_name)
    `)
    .in("segment_id", stageIds)
    .eq("status", "submitted")
    .in("contestant_id", expectedContestantIds);

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<
    string,
    {
      contestantId: string;
      sbd: string;
      fullName: string;
      stage1Scores: number[];
      stage2Scores: number[];
      stage1JudgeIds: Set<string>;
      stage2JudgeIds: Set<string>;
    }
  >();

  for (const contestantId of expectedContestantIds) {
    const contestant = contestantsById.get(String(contestantId));

    grouped.set(String(contestantId), {
      contestantId: String(contestantId),
      sbd: contestant?.sbd || "",
      fullName: contestant?.full_name || "",
      stage1Scores: [],
      stage2Scores: [],
      stage1JudgeIds: new Set<string>(),
      stage2JudgeIds: new Set<string>(),
    });
  }

  for (const sheet of sheets || []) {
    const contestant = pickRelation((sheet as any).contestant);
    const contestantId = String((sheet as any).contestant_id);
    const segmentId = String((sheet as any).segment_id);
    const score = Number((sheet as any).total_score ?? 0);
    const judgeId = (sheet as any).judge_id
      ? String((sheet as any).judge_id)
      : "";

    if (!grouped.has(contestantId)) {
      grouped.set(contestantId, {
        contestantId,
        sbd: contestant?.sbd || "",
        fullName: contestant?.full_name || "",
        stage1Scores: [],
        stage2Scores: [],
        stage1JudgeIds: new Set<string>(),
        stage2JudgeIds: new Set<string>(),
      });
    }

    const current = grouped.get(contestantId)!;

    if (segmentId === "round3_stage1") {
      current.stage1Scores.push(score);

      if (judgeId) {
        current.stage1JudgeIds.add(judgeId);
      }
    }

    if (segmentId === "round3_stage2") {
      current.stage2Scores.push(score);

      if (judgeId) {
        current.stage2JudgeIds.add(judgeId);
      }
    }
  }

  const missingRows: {
    sbd: string;
    fullName: string;
    segmentLabel: string;
    count: number;
  }[] = [];

  for (const row of grouped.values()) {
    if (row.stage1JudgeIds.size < REQUIRED_JUDGE_COUNT) {
      missingRows.push({
        sbd: row.sbd,
        fullName: row.fullName,
        segmentLabel: "Chặng 1",
        count: row.stage1JudgeIds.size,
      });
    }

    if (row.stage2JudgeIds.size < REQUIRED_JUDGE_COUNT) {
      missingRows.push({
        sbd: row.sbd,
        fullName: row.fullName,
        segmentLabel: "Chặng 2",
        count: row.stage2JudgeIds.size,
      });
    }
  }

  if (missingRows.length > 0) {
    throw new Error(
      `Chưa thể lấy Top 3 vào chặng 3 vì còn thí sinh chưa đủ ${REQUIRED_JUDGE_COUNT}/5 phiếu chấm ở chặng 1 hoặc chặng 2: ${formatMissingList(
        missingRows
      )}${missingRows.length > 12 ? "; ..." : ""}`
    );
  }

  const rankedRows = Array.from(grouped.values()).map((row) => {
    const stage1Average = average(row.stage1Scores);
    const stage2Average = average(row.stage2Scores);

    return {
      contestantId: row.contestantId,
      sbd: row.sbd,
      fullName: row.fullName,
      score: Number(stage1Average ?? 0) + Number(stage2Average ?? 0),
    };
  });

  return sortRankedRows(rankedRows);
}

async function promoteContestantsToSegments(
  adminSupabase: any,
  contestantIds: string[],
  segmentIds: string[]
) {
  const { error: deleteError } = await adminSupabase
    .from("segment_contestants")
    .delete()
    .in("segment_id", segmentIds);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const insertRows = segmentIds.flatMap((segmentId) =>
    contestantIds.map((contestantId) => ({
      segment_id: segmentId,
      contestant_id: contestantId,
    }))
  );

  if (insertRows.length === 0) {
    return;
  }

  const { error: insertError } = await adminSupabase
    .from("segment_contestants")
    .insert(insertRows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { user, adminSupabase } = auth;
  const body = await parseRequest(req);

  const action = String(body.action || "");
  const topN = Number(body.topN || 0);

  try {
    if (action === "round2_to_stage12") {
      const rankedRows = await getRound2RankedContestants(adminSupabase);

      const resolved = await resolveTopWithTie({
        adminSupabase,
        transitionKey: "round2_to_round3",
        title: "Vote chọn thí sinh vào vòng 3",
        description:
          "Có thí sinh đồng điểm ở ngưỡng Top 10 vòng 2. Giám khảo vote để chọn thí sinh đi tiếp vào vòng 3.",
        topN: topN || 10,
        rows: rankedRows,
        createdBy: user.id,
      });

      if (resolved.tieBreak?.needsVote) {
        return NextResponse.redirect(
          new URL("/admin/tie-breaks?created=round2_to_round3", req.url),
          { status: 303 }
        );
      }

      const contestantIds: string[] = resolved.qualifiedRows.map((row) =>
        String(row.contestantId)
      );

      await promoteContestantsToSegments(adminSupabase, contestantIds, [
        "round3_stage1",
        "round3_stage2",
      ]);

      return NextResponse.redirect(
        new URL("/admin/round3-results?done=round2_to_stage12", req.url),
        { status: 303 }
      );
    }

    if (action === "stage12_to_top3") {
      const rankedRows = await getStage12RankedContestants(adminSupabase);

      const resolved = await resolveTopWithTie({
        adminSupabase,
        transitionKey: "round3_stage12_to_stage3",
        title: "Vote chọn thí sinh vào chặng 3 vòng 3",
        description:
          "Có thí sinh đồng điểm ở ngưỡng Top 3 sau chặng 1 + chặng 2. Giám khảo vote để chọn thí sinh vào chặng 3.",
        topN: topN || 3,
        rows: rankedRows,
        createdBy: user.id,
      });

      if (resolved.tieBreak?.needsVote) {
        return NextResponse.redirect(
          new URL("/admin/tie-breaks?created=round3_stage12_to_stage3", req.url),
          { status: 303 }
        );
      }

      const contestantIds: string[] = resolved.qualifiedRows.map((row) =>
        String(row.contestantId)
      );

      await promoteContestantsToSegments(adminSupabase, contestantIds, [
        "round3_stage3",
      ]);

      return NextResponse.redirect(
        new URL("/admin/round3-results?done=stage12_to_top3", req.url),
        { status: 303 }
      );
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi chuyển vòng" },
      { status: 500 }
    );
  }
}
