import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRED_JUDGE_COUNT = 5;

const ROUND_CONFIG: Record<
  string,
  {
    label: string;
    segments: string[];
  }
> = {
  round2: {
    label: "Vòng 2",
    segments: ["round2_semifinal"],
  },
  round3: {
    label: "Vòng 3",
    segments: ["round3_stage1", "round3_stage2", "round3_stage3"],
  },
};

async function getCurrentJudge() {
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
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "judge") {
    return {
      error: NextResponse.json(
        { error: "Chỉ giám khảo mới được kết thúc chấm" },
        { status: 403 }
      ),
    };
  }

  return {
    adminSupabase,
    user,
    profile,
  };
}

async function countCompletedJudges(adminSupabase: any, roundKey: string) {
  const { data, error } = await adminSupabase
    .from("judge_round_completions")
    .select("judge_id")
    .eq("round_key", roundKey)
    .eq("status", "completed");

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data || []).map((row: any) => String(row.judge_id))).size;
}

async function getRound2ExpectedContestants(adminSupabase: any): Promise<string[]> {
  const { data: pairs, error: pairsError } = await adminSupabase
    .from("round2_pairs")
    .select("id")
    .eq("segment_id", "round2_semifinal");

  if (pairsError) {
    throw new Error(pairsError.message);
  }

  const pairIds: string[] = (pairs || []).map((pair: any) => String(pair.id));

  if (pairIds.length === 0) {
    return [];
  }

  const { data: members, error: membersError } = await adminSupabase
    .from("round2_pair_members")
    .select("contestant_id")
    .in("pair_id", pairIds);

  if (membersError) {
    throw new Error(membersError.message);
  }

  return [...new Set((members || []).map((member: any) => String(member.contestant_id)))];
}

async function getRound3ExpectedContestantsByStage(
  adminSupabase: any
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {
    round3_stage1: [],
    round3_stage2: [],
    round3_stage3: [],
  };

  const { data, error } = await adminSupabase
    .from("segment_contestants")
    .select("segment_id, contestant_id")
    .in("segment_id", ["round3_stage1", "round3_stage2", "round3_stage3"]);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data || []) {
    const segmentId = String((row as any).segment_id);
    const contestantId = String((row as any).contestant_id);

    if (!result[segmentId]) {
      result[segmentId] = [];
    }

    result[segmentId].push(contestantId);
  }

  return result;
}

async function getSubmittedContestants(
  adminSupabase: any,
  judgeId: string,
  segmentId: string,
  contestantIds: string[]
): Promise<Set<string>> {
  if (contestantIds.length === 0) return new Set<string>();

  const { data, error } = await adminSupabase
    .from("score_sheets")
    .select("contestant_id")
    .eq("judge_id", judgeId)
    .eq("segment_id", segmentId)
    .eq("status", "submitted")
    .in("contestant_id", contestantIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data || []).map((row: any) => String(row.contestant_id)));
}

async function checkRound2Completeness(adminSupabase: any, judgeId: string) {
  const expectedContestantIds = await getRound2ExpectedContestants(adminSupabase);

  if (expectedContestantIds.length === 0) {
    return {
      ok: false,
      missingCount: 0,
      expectedCount: 0,
      message: "Chưa có danh sách cặp vòng 2. Admin cần gán cặp trước.",
    };
  }

  const submittedContestantIds = await getSubmittedContestants(
    adminSupabase,
    judgeId,
    "round2_semifinal",
    expectedContestantIds
  );

  const missingCount = expectedContestantIds.filter(
    (contestantId) => !submittedContestantIds.has(contestantId)
  ).length;

  return {
    ok: missingCount === 0,
    missingCount,
    expectedCount: expectedContestantIds.length,
    message:
      missingCount === 0
        ? "Đã nộp đủ điểm vòng 2."
        : `Bạn còn ${missingCount}/${expectedContestantIds.length} thí sinh vòng 2 chưa nộp điểm.`,
  };
}

async function checkRound3Completeness(adminSupabase: any, judgeId: string) {
  const expectedByStage = await getRound3ExpectedContestantsByStage(adminSupabase);

  const stage1Ids = expectedByStage.round3_stage1 || [];
  const stage2Ids = expectedByStage.round3_stage2 || [];
  const stage3Ids = expectedByStage.round3_stage3 || [];

  if (stage1Ids.length === 0 || stage2Ids.length === 0) {
    return {
      ok: false,
      missingCount: 0,
      expectedCount: 0,
      message: "Chưa có danh sách thí sinh vòng 3 chặng 1 và chặng 2.",
    };
  }

  if (stage3Ids.length === 0) {
    return {
      ok: false,
      missingCount: 0,
      expectedCount: stage1Ids.length + stage2Ids.length,
      message:
        "Chặng 3 chưa mở. Admin cần lấy Top thí sinh sau chặng 1 + chặng 2 vào chặng 3 trước.",
    };
  }

  const stage1Submitted = await getSubmittedContestants(
    adminSupabase,
    judgeId,
    "round3_stage1",
    stage1Ids
  );

  const stage2Submitted = await getSubmittedContestants(
    adminSupabase,
    judgeId,
    "round3_stage2",
    stage2Ids
  );

  const stage3Submitted = await getSubmittedContestants(
    adminSupabase,
    judgeId,
    "round3_stage3",
    stage3Ids
  );

  const stage1Missing = stage1Ids.filter((id) => !stage1Submitted.has(id)).length;
  const stage2Missing = stage2Ids.filter((id) => !stage2Submitted.has(id)).length;
  const stage3Missing = stage3Ids.filter((id) => !stage3Submitted.has(id)).length;

  const missingCount = stage1Missing + stage2Missing + stage3Missing;
  const expectedCount = stage1Ids.length + stage2Ids.length + stage3Ids.length;

  return {
    ok: missingCount === 0,
    missingCount,
    expectedCount,
    message:
      missingCount === 0
        ? "Đã nộp đủ điểm vòng 3."
        : `Bạn còn ${missingCount}/${expectedCount} phiếu vòng 3 chưa nộp. Chặng 1 còn ${stage1Missing}, chặng 2 còn ${stage2Missing}, chặng 3 còn ${stage3Missing}.`,
  };
}

async function checkCompleteness(adminSupabase: any, judgeId: string, roundKey: string) {
  if (roundKey === "round2") {
    return checkRound2Completeness(adminSupabase, judgeId);
  }

  if (roundKey === "round3") {
    return checkRound3Completeness(adminSupabase, judgeId);
  }

  return {
    ok: false,
    missingCount: 0,
    expectedCount: 0,
    message: "roundKey không hợp lệ.",
  };
}

export async function POST(req: Request) {
  const auth = await getCurrentJudge();

  if ("error" in auth) {
    return auth.error;
  }

  const { adminSupabase, profile } = auth;
  const body = await req.json();

  const roundKey = String(body.roundKey || "");

  if (!ROUND_CONFIG[roundKey]) {
    return NextResponse.json(
      { error: "roundKey không hợp lệ. Chỉ nhận round2 hoặc round3." },
      { status: 400 }
    );
  }

  try {
    const completeness = await checkCompleteness(adminSupabase, profile.id, roundKey);

    if (!completeness.ok) {
      return NextResponse.json(
        {
          error: completeness.message,
          missingCount: completeness.missingCount,
          expectedCount: completeness.expectedCount,
        },
        { status: 400 }
      );
    }

    const { error: upsertError } = await adminSupabase
      .from("judge_round_completions")
      .upsert(
        {
          round_key: roundKey,
          judge_id: profile.id,
          status: "completed",
          completed_at: new Date().toISOString(),
        },
        {
          onConflict: "round_key,judge_id",
        }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const completedJudgeCount = await countCompletedJudges(adminSupabase, roundKey);
    const readyToFinalize = completedJudgeCount >= REQUIRED_JUDGE_COUNT;

    return NextResponse.json({
      ok: true,
      roundKey,
      roundLabel: ROUND_CONFIG[roundKey].label,
      completedJudgeCount,
      requiredJudgeCount: REQUIRED_JUDGE_COUNT,
      readyToFinalize,
      message: readyToFinalize
        ? `Đã đủ ${REQUIRED_JUDGE_COUNT}/${REQUIRED_JUDGE_COUNT} giám khảo kết thúc chấm. Admin có thể chốt điểm trung bình.`
        : `Đã ghi nhận kết thúc chấm. Hiện có ${completedJudgeCount}/${REQUIRED_JUDGE_COUNT} giám khảo hoàn tất.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi kết thúc chấm" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const auth = await getCurrentJudge();

  if ("error" in auth) {
    return auth.error;
  }

  const { adminSupabase, profile } = auth;
  const { searchParams } = new URL(req.url);
  const roundKey = String(searchParams.get("roundKey") || "");

  if (!ROUND_CONFIG[roundKey]) {
    return NextResponse.json(
      { error: "roundKey không hợp lệ. Chỉ nhận round2 hoặc round3." },
      { status: 400 }
    );
  }

  try {
    const { data: myCompletion, error: myCompletionError } = await adminSupabase
      .from("judge_round_completions")
      .select("round_key, judge_id, status, completed_at")
      .eq("round_key", roundKey)
      .eq("judge_id", profile.id)
      .maybeSingle();

    if (myCompletionError) {
      return NextResponse.json({ error: myCompletionError.message }, { status: 500 });
    }

    const completedJudgeCount = await countCompletedJudges(adminSupabase, roundKey);
    const completeness = await checkCompleteness(adminSupabase, profile.id, roundKey);

    return NextResponse.json({
      ok: true,
      roundKey,
      roundLabel: ROUND_CONFIG[roundKey].label,
      completed: myCompletion?.status === "completed",
      completedAt: myCompletion?.completed_at || null,
      completedJudgeCount,
      requiredJudgeCount: REQUIRED_JUDGE_COUNT,
      readyToFinalize: completedJudgeCount >= REQUIRED_JUDGE_COUNT,
      canComplete: completeness.ok,
      completenessMessage: completeness.message,
      missingCount: completeness.missingCount,
      expectedCount: completeness.expectedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi kiểm tra trạng thái kết thúc chấm" },
      { status: 500 }
    );
  }
}
