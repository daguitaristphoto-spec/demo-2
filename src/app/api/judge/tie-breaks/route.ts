import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRED_JUDGE_COUNT = 5;

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireJudge() {
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

  if (profileError || !profile || profile.role !== "judge") {
    return {
      error: NextResponse.json(
        { error: "Chỉ giám khảo mới được vote đồng điểm" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    profile,
    adminSupabase,
  };
}

export async function GET() {
  const auth = await requireJudge();

  if ("error" in auth) {
    return auth.error;
  }

  const { profile, adminSupabase } = auth;

  const { data: sessions, error: sessionsError } = await adminSupabase
    .from("tie_break_sessions")
    .select("*")
    .eq("status", "open")
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
      contestant:contestants(id, sbd, full_name)
    `)
    .in("session_id", sessionIds)
    .order("source_score", { ascending: false });

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const { data: myVotes, error: votesError } = await adminSupabase
    .from("tie_break_votes")
    .select("session_id, contestant_id")
    .eq("judge_id", profile.id)
    .in("session_id", sessionIds);

  if (votesError) {
    return NextResponse.json({ error: votesError.message }, { status: 500 });
  }

  const { data: allVotes, error: allVotesError } = await adminSupabase
    .from("tie_break_votes")
    .select("session_id, judge_id")
    .in("session_id", sessionIds);

  if (allVotesError) {
    return NextResponse.json({ error: allVotesError.message }, { status: 500 });
  }

  const normalizedSessions = sessionRows.map((session: any) => {
    const sessionCandidates = (candidates || [])
      .filter((candidate: any) => candidate.session_id === session.id)
      .map((candidate: any) => {
        const contestant = pickRelation(candidate.contestant);

        return {
          id: candidate.id,
          contestantId: candidate.contestant_id,
          sbd: contestant?.sbd || "",
          fullName: contestant?.full_name || "",
          sourceScore: Number(candidate.source_score ?? 0),
        };
      });

    const selectedContestantIds = new Set(
      (myVotes || [])
        .filter((vote: any) => vote.session_id === session.id)
        .map((vote: any) => String(vote.contestant_id))
    );

    const votedJudgeIds = new Set(
      (allVotes || [])
        .filter((vote: any) => vote.session_id === session.id)
        .map((vote: any) => String(vote.judge_id))
    );

    return {
      id: session.id,
      transitionKey: session.transition_key,
      title: session.title,
      description: session.description,
      cutoffScore: session.cutoff_score,
      slotsToFill: session.slots_to_fill,
      createdAt: session.created_at,
      requiredJudgeCount: REQUIRED_JUDGE_COUNT,
      votedJudgeCount: votedJudgeIds.size,
      candidates: sessionCandidates,
      mySelectedContestantIds: Array.from(selectedContestantIds),
    };
  });

  return NextResponse.json({
    sessions: normalizedSessions,
  });
}

export async function POST(req: Request) {
  const auth = await requireJudge();

  if ("error" in auth) {
    return auth.error;
  }

  const { profile, adminSupabase } = auth;
  const body = await req.json();

  const sessionId = String(body.sessionId || "");
  const contestantIds = Array.isArray(body.contestantIds)
    ? body.contestantIds.map((id: any) => String(id))
    : [];

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

  if (session.status !== "open") {
    return NextResponse.json({ error: "Phiên vote đã đóng" }, { status: 400 });
  }

  if (contestantIds.length === 0) {
    return NextResponse.json({ error: "Bạn cần chọn ít nhất 1 thí sinh" }, { status: 400 });
  }

  if (contestantIds.length > Number(session.slots_to_fill)) {
    return NextResponse.json(
      {
        error: `Chỉ được chọn tối đa ${session.slots_to_fill} thí sinh`,
      },
      { status: 400 }
    );
  }

  const { data: candidates, error: candidatesError } = await adminSupabase
    .from("tie_break_candidates")
    .select("contestant_id")
    .eq("session_id", sessionId);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const validCandidateIds = new Set(
    (candidates || []).map((candidate: any) => String(candidate.contestant_id))
  );

  for (const contestantId of contestantIds) {
    if (!validCandidateIds.has(contestantId)) {
      return NextResponse.json(
        { error: "Có thí sinh không thuộc phiên vote này" },
        { status: 400 }
      );
    }
  }

  const { error: deleteError } = await adminSupabase
    .from("tie_break_votes")
    .delete()
    .eq("session_id", sessionId)
    .eq("judge_id", profile.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const insertRows = contestantIds.map((contestantId: string) => ({
    session_id: sessionId,
    judge_id: profile.id,
    contestant_id: contestantId,
  }));

  const { error: insertError } = await adminSupabase
    .from("tie_break_votes")
    .insert(insertRows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Đã ghi nhận phiếu vote của bạn",
  });
}
