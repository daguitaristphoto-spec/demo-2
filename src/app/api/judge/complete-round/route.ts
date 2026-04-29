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

async function getCurrentUserAndProfile() {
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
    supabase,
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

  const uniqueJudgeIds = new Set((data || []).map((row: any) => row.judge_id));

  return uniqueJudgeIds.size;
}

async function checkJudgeHasSubmittedSomething(
  adminSupabase: any,
  judgeId: string,
  roundKey: string
) {
  const config = ROUND_CONFIG[roundKey];

  const { data, error } = await adminSupabase
    .from("score_sheets")
    .select("id")
    .eq("judge_id", judgeId)
    .eq("status", "submitted")
    .in("segment_id", config.segments)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).length > 0;
}

export async function POST(req: Request) {
  const auth = await getCurrentUserAndProfile();

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
    const hasSubmittedSomething = await checkJudgeHasSubmittedSomething(
      adminSupabase,
      profile.id,
      roundKey
    );

    if (!hasSubmittedSomething) {
      return NextResponse.json(
        {
          error: `Bạn chưa có phiếu chấm đã nộp ở ${ROUND_CONFIG[roundKey].label}.`,
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
  const auth = await getCurrentUserAndProfile();

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

    return NextResponse.json({
      ok: true,
      roundKey,
      roundLabel: ROUND_CONFIG[roundKey].label,
      completed: myCompletion?.status === "completed",
      completedAt: myCompletion?.completed_at || null,
      completedJudgeCount,
      requiredJudgeCount: REQUIRED_JUDGE_COUNT,
      readyToFinalize: completedJudgeCount >= REQUIRED_JUDGE_COUNT,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi kiểm tra trạng thái kết thúc chấm" },
      { status: 500 }
    );
  }
}
