import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRED_JUDGE_COUNT = 5;

const ROUND_CONFIG = [
  {
    roundKey: "round2",
    label: "Vòng 2",
    description: "Bán kết - Vượt ải",
  },
  {
    roundKey: "round3",
    label: "Vòng 3",
    description: "Chung kết - Mã đáo thành công",
  },
];

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
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Chỉ admin mới được xem trạng thái kết thúc chấm" },
        { status: 403 }
      ),
    };
  }

  return {
    adminSupabase,
    profile,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { adminSupabase } = auth;

  try {
    const { data: judges, error: judgesError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "judge")
      .order("full_name");

    if (judgesError) {
      return NextResponse.json({ error: judgesError.message }, { status: 500 });
    }

    const roundKeys = ROUND_CONFIG.map((round) => round.roundKey);

    const { data: completions, error: completionsError } = await adminSupabase
      .from("judge_round_completions")
      .select("round_key, judge_id, status, completed_at")
      .in("round_key", roundKeys)
      .eq("status", "completed");

    if (completionsError) {
      return NextResponse.json({ error: completionsError.message }, { status: 500 });
    }

    const judgeRows = judges || [];
    const completionRows = completions || [];

    const rounds = ROUND_CONFIG.map((round) => {
      const completedJudgeIds = new Set(
        completionRows
          .filter((completion: any) => completion.round_key === round.roundKey)
          .map((completion: any) => String(completion.judge_id))
      );

      const judgeStatuses = judgeRows.map((judge: any) => {
        const completion = completionRows.find(
          (item: any) =>
            item.round_key === round.roundKey &&
            String(item.judge_id) === String(judge.id)
        );

        return {
          judgeId: String(judge.id),
          fullName: judge.full_name || judge.email || "Giám khảo",
          email: judge.email || null,
          completed: Boolean(completion),
          completedAt: completion?.completed_at || null,
        };
      });

      const completedJudgeCount = completedJudgeIds.size;

      return {
        roundKey: round.roundKey,
        label: round.label,
        description: round.description,
        requiredJudgeCount: REQUIRED_JUDGE_COUNT,
        completedJudgeCount,
        readyToFinalize: completedJudgeCount >= REQUIRED_JUDGE_COUNT,
        judges: judgeStatuses,
      };
    });

    return NextResponse.json({
      ok: true,
      rounds,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Có lỗi khi tải trạng thái kết thúc chấm" },
      { status: 500 }
    );
  }
}
