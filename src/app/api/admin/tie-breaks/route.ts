import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Chỉ admin mới được quản lý vote" }, { status: 403 }),
    };
  }

  return {
    user,
    profile,
    adminSupabase,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { adminSupabase } = auth;

  const { data: sessions, error: sessionsError } = await adminSupabase
    .from("tie_break_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  const sessionRows = sessions || [];
  const sessionIds = sessionRows.map((session: any) => session.id);

  if (sessionIds.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  const { data: candidates, error: candidatesError } = await adminSupabase
    .from("tie_break_candidates")
    .select(`
      id,
      session_id,
      contestant_id,
      source_score,
      selected,
      contestant:contestants(id, sbd, full_name)
    `)
    .in("session_id", sessionIds)
    .order("source_score", { ascending: false });

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const { data: votes, error: votesError } = await adminSupabase
    .from("tie_break_votes")
    .select("session_id, judge_id, contestant_id")
    .in("session_id", sessionIds);

  if (votesError) {
    return NextResponse.json({ error: votesError.message }, { status: 500 });
  }

  const normalizedSessions = sessionRows.map((session: any) => {
    const sessionVotes = (votes || []).filter((vote: any) => vote.session_id === session.id);

    const votedJudgeIds = new Set(sessionVotes.map((vote: any) => String(vote.judge_id)));

    const sessionCandidates = (candidates || [])
      .filter((candidate: any) => candidate.session_id === session.id)
      .map((candidate: any) => {
        const contestant = pickRelation(candidate.contestant);
        const voteCount = sessionVotes.filter(
          (vote: any) => String(vote.contestant_id) === String(candidate.contestant_id)
        ).length;

        return {
          id: candidate.id,
          contestantId: candidate.contestant_id,
          sbd: contestant?.sbd || "",
          fullName: contestant?.full_name || "",
          sourceScore: Number(candidate.source_score ?? 0),
          voteCount,
          selected: Boolean(candidate.selected),
        };
      })
      .sort((a, b) => b.voteCount - a.voteCount || b.sourceScore - a.sourceScore);

    return {
      id: session.id,
      transitionKey: session.transition_key,
      title: session.title,
      description: session.description,
      status: session.status,
      cutoffScore: session.cutoff_score,
      slotsToFill: session.slots_to_fill,
      createdAt: session.created_at,
      closedAt: session.closed_at,
      requiredJudgeCount: REQUIRED_JUDGE_COUNT,
      votedJudgeCount: votedJudgeIds.size,
      candidates: sessionCandidates,
    };
  });

  return NextResponse.json({
    sessions: normalizedSessions,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { adminSupabase } = auth;
  const body = await req.json();

  const action = String(body.action || "");
  const sessionId = String(body.sessionId || "");

  if (!sessionId) {
    return NextResponse.json({ error: "Thiếu phiên vote" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await adminSupabase
    .from("tie_break_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Không tìm thấy phiên vote" }, { status: 404 });
  }

  if (action === "cancel") {
    const { error } = await adminSupabase
      .from("tie_break_sessions")
      .update({
        status: "cancelled",
        closed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Đã hủy phiên vote" });
  }

  if (action !== "close") {
    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  }

  if (session.status !== "open") {
    return NextResponse.json({ error: "Phiên vote không còn mở" }, { status: 400 });
  }

  const { data: votes, error: votesError } = await adminSupabase
    .from("tie_break_votes")
    .select("judge_id, contestant_id")
    .eq("session_id", sessionId);

  if (votesError) {
    return NextResponse.json({ error: votesError.message }, { status: 500 });
  }

  const votedJudgeIds = new Set((votes || []).map((vote: any) => String(vote.judge_id)));

  if (votedJudgeIds.size < REQUIRED_JUDGE_COUNT) {
    return NextResponse.json(
      {
        error: `Chưa đủ ${REQUIRED_JUDGE_COUNT} giám khảo vote. Hiện mới có ${votedJudgeIds.size}/${REQUIRED_JUDGE_COUNT}.`,
      },
      { status: 400 }
    );
  }

  const { data: candidates, error: candidatesError } = await adminSupabase
    .from("tie_break_candidates")
    .select("contestant_id, source_score")
    .eq("session_id", sessionId);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const voteCounts = new Map<string, number>();

  for (const candidate of candidates || []) {
    voteCounts.set(String(candidate.contestant_id), 0);
  }

  for (const vote of votes || []) {
    const contestantId = String((vote as any).contestant_id);
    voteCounts.set(contestantId, (voteCounts.get(contestantId) || 0) + 1);
  }

  const rankedCandidates = (candidates || [])
    .map((candidate: any) => ({
      contestantId: String(candidate.contestant_id),
      sourceScore: Number(candidate.source_score ?? 0),
      voteCount: voteCounts.get(String(candidate.contestant_id)) || 0,
    }))
    .sort((a, b) => b.voteCount - a.voteCount || b.sourceScore - a.sourceScore);

  const slotsToFill = Number(session.slots_to_fill || 1);
  const selected = rankedCandidates.slice(0, slotsToFill);
  const boundary = selected[selected.length - 1];
  const next = rankedCandidates[slotsToFill];

  if (boundary && next && boundary.voteCount === next.voteCount) {
    return NextResponse.json(
      {
        error:
          "Kết quả vote vẫn đang hòa ở ngưỡng chọn. Cần họp thống nhất hoặc tạo phiên vote bổ sung.",
      },
      { status: 400 }
    );
  }

  const selectedIds = new Set(selected.map((item) => item.contestantId));

  const { error: resetError } = await adminSupabase
    .from("tie_break_candidates")
    .update({ selected: false })
    .eq("session_id", sessionId);

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 });
  }

  if (selectedIds.size > 0) {
    const { error: selectedError } = await adminSupabase
      .from("tie_break_candidates")
      .update({ selected: true })
      .eq("session_id", sessionId)
      .in("contestant_id", Array.from(selectedIds));

    if (selectedError) {
      return NextResponse.json({ error: selectedError.message }, { status: 500 });
    }
  }

  const { error: closeError } = await adminSupabase
    .from("tie_break_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (closeError) {
    return NextResponse.json({ error: closeError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Đã chốt kết quả vote",
    selectedContestantIds: Array.from(selectedIds),
  });
}
