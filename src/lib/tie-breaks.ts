export type TransitionKey =
  | "round1_to_round2"
  | "round2_to_round3"
  | "round3_stage12_to_stage3";

export type RankedContestant = {
  contestantId: string;
  sbd: string;
  fullName: string;
  score: number;
};

type ResolveTopWithTieInput = {
  adminSupabase: any;
  transitionKey: TransitionKey;
  title: string;
  description: string;
  topN: number;
  rows: RankedContestant[];
  createdBy?: string | null;
};

type TieBreakInfo = {
  needsVote: boolean;
  sessionId: string;
  transitionKey: TransitionKey;
  title: string;
  description: string;
  cutoffScore: number;
  slotsToFill: number;
  candidates: RankedContestant[];
};

export type ResolveTopWithTieResult = {
  qualifiedRows: RankedContestant[];
  tieBreak: TieBreakInfo | null;
};

function normalizeScore(value: any) {
  const numberValue = Number(value ?? 0);

  if (Number.isNaN(numberValue)) {
    return 0;
  }

  return Math.round(numberValue * 100) / 100;
}

function sortRows(rows: RankedContestant[]) {
  return [...rows].sort((a, b) => {
    const scoreDiff = normalizeScore(b.score) - normalizeScore(a.score);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return String(a.sbd || "").localeCompare(String(b.sbd || ""), "vi");
  });
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;

  const setA = new Set(a.map(String));

  return b.every((item) => setA.has(String(item)));
}

async function findMatchingClosedSession(
  adminSupabase: any,
  transitionKey: TransitionKey,
  candidateIds: string[]
) {
  const { data: sessions, error: sessionsError } = await adminSupabase
    .from("tie_break_sessions")
    .select("id, transition_key, status, created_at")
    .eq("transition_key", transitionKey)
    .eq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(20);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const sessionRows = sessions || [];

  if (sessionRows.length === 0) {
    return null;
  }

  const sessionIds = sessionRows.map((session: any) => session.id);

  const { data: candidates, error: candidatesError } = await adminSupabase
    .from("tie_break_candidates")
    .select("session_id, contestant_id, selected")
    .in("session_id", sessionIds);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  for (const session of sessionRows) {
    const sessionCandidates = (candidates || []).filter(
      (candidate: any) => candidate.session_id === session.id
    );

    const sessionCandidateIds = sessionCandidates.map((candidate: any) =>
      String(candidate.contestant_id)
    );

    if (!sameSet(sessionCandidateIds, candidateIds)) {
      continue;
    }

    const selectedContestantIds = sessionCandidates
      .filter((candidate: any) => candidate.selected)
      .map((candidate: any) => String(candidate.contestant_id));

    return {
      sessionId: session.id,
      selectedContestantIds,
    };
  }

  return null;
}

async function findOpenSession(adminSupabase: any, transitionKey: TransitionKey) {
  const { data, error } = await adminSupabase
    .from("tie_break_sessions")
    .select("id, title, description, cutoff_score, slots_to_fill")
    .eq("transition_key", transitionKey)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

async function createOpenSession({
  adminSupabase,
  transitionKey,
  title,
  description,
  cutoffScore,
  slotsToFill,
  candidates,
  createdBy,
}: {
  adminSupabase: any;
  transitionKey: TransitionKey;
  title: string;
  description: string;
  cutoffScore: number;
  slotsToFill: number;
  candidates: RankedContestant[];
  createdBy?: string | null;
}) {
  const existingOpenSession = await findOpenSession(adminSupabase, transitionKey);

  if (existingOpenSession?.id) {
    return existingOpenSession;
  }

  const { data: session, error: sessionError } = await adminSupabase
    .from("tie_break_sessions")
    .insert({
      transition_key: transitionKey,
      title,
      description,
      cutoff_score: cutoffScore,
      slots_to_fill: slotsToFill,
      created_by: createdBy || null,
      status: "open",
    })
    .select("id, title, description, cutoff_score, slots_to_fill")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message || "Không tạo được phiên vote đồng điểm");
  }

  const candidateRows = candidates.map((candidate) => ({
    session_id: session.id,
    contestant_id: candidate.contestantId,
    source_score: normalizeScore(candidate.score),
  }));

  const { error: candidatesError } = await adminSupabase
    .from("tie_break_candidates")
    .insert(candidateRows);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  return session;
}

export async function resolveTopWithTie({
  adminSupabase,
  transitionKey,
  title,
  description,
  topN,
  rows,
  createdBy,
}: ResolveTopWithTieInput): Promise<ResolveTopWithTieResult> {
  const sortedRows = sortRows(
    rows.map((row) => ({
      ...row,
      score: normalizeScore(row.score),
    }))
  );

  if (sortedRows.length <= topN) {
    return {
      qualifiedRows: sortedRows,
      tieBreak: null,
    };
  }

  const cutoffScore = normalizeScore(sortedRows[topN - 1]?.score);

  const aboveCutoffRows = sortedRows.filter(
    (row) => normalizeScore(row.score) > cutoffScore
  );

  const tiedRows = sortedRows.filter(
    (row) => normalizeScore(row.score) === cutoffScore
  );

  const slotsToFill = topN - aboveCutoffRows.length;

  if (tiedRows.length <= slotsToFill) {
    return {
      qualifiedRows: sortedRows.slice(0, topN),
      tieBreak: null,
    };
  }

  const tiedContestantIds = tiedRows.map((row) => String(row.contestantId));

  const closedSession = await findMatchingClosedSession(
    adminSupabase,
    transitionKey,
    tiedContestantIds
  );

  if (closedSession?.selectedContestantIds?.length) {
    const selectedIdSet = new Set(closedSession.selectedContestantIds.map(String));

    const selectedRows = tiedRows.filter((row) =>
      selectedIdSet.has(String(row.contestantId))
    );

    if (selectedRows.length >= slotsToFill) {
      return {
        qualifiedRows: [...aboveCutoffRows, ...selectedRows.slice(0, slotsToFill)],
        tieBreak: null,
      };
    }
  }

  const openSession = await createOpenSession({
    adminSupabase,
    transitionKey,
    title,
    description,
    cutoffScore,
    slotsToFill,
    candidates: tiedRows,
    createdBy,
  });

  return {
    qualifiedRows: aboveCutoffRows,
    tieBreak: {
      needsVote: true,
      sessionId: openSession.id,
      transitionKey,
      title,
      description,
      cutoffScore,
      slotsToFill,
      candidates: tiedRows,
    },
  };
}
