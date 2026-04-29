import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTopWithTie, type RankedContestant } from "@/lib/tie-breaks";

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
      error: NextResponse.json({ error: "Chỉ admin mới được thao tác" }, { status: 403 }),
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

async function getRound2RankedContestants(adminSupabase: any): Promise<RankedContestant[]> {
  const { data: sheets, error } = await adminSupabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      total_score,
      contestant:contestants(id, sbd, full_name)
    `)
    .eq("segment_id", "round2_semifinal")
    .eq("status", "submitted");

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
    .map((row) => ({
      contestantId: row.contestantId,
      sbd: row.sbd,
      fullName: row.fullName,
      score: average(row.scores) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || String(a.sbd).localeCompare(String(b.sbd), "vi"));
}

async function getStage12RankedContestants(adminSupabase: any): Promise<RankedContestant[]> {
  const { data: sheets, error } = await adminSupabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      segment_id,
      total_score,
      contestant:contestants(id, sbd, full_name)
    `)
    .in("segment_id", ["round3_stage1", "round3_stage2"])
    .eq("status", "submitted");

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
        stage1Scores: [],
        stage2Scores: [],
      });
    }

    const current = grouped.get(contestant.id)!;
    const score = Number((sheet as any).total_score ?? 0);
    const segmentId = String((sheet as any).segment_id);

    if (segmentId === "round3_stage1") {
      current.stage1Scores.push(score);
    }

    if (segmentId === "round3_stage2") {
      current.stage2Scores.push(score);
    }
  }

  return Array.from(grouped.values())
    .map((row) => {
      const stage1Average = average(row.stage1Scores);
      const stage2Average = average(row.stage2Scores);

      if (stage1Average === null || stage2Average === null) {
        return null;
      }

      return {
        contestantId: row.contestantId,
        sbd: row.sbd,
        fullName: row.fullName,
        score: stage1Average + stage2Average,
      };
    })
    .filter(Boolean) as RankedContestant[];
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
  if ("error" in auth) return auth.error;

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
          new URL("/admin/tie-breaks?created=round2_to_round3", req.url)
        );
      }

      const contestantIds = resolved.qualifiedRows.map((row) => row.contestantId);

      await promoteContestantsToSegments(adminSupabase, contestantIds, [
        "round3_stage1",
        "round3_stage2",
      ]);

      return NextResponse.redirect(
        new URL("/admin/round3-results?done=round2_to_stage12", req.url)
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
          new URL("/admin/tie-breaks?created=round3_stage12_to_stage3", req.url)
        );
      }

      const contestantIds = resolved.qualifiedRows.map((row) => row.contestantId);

      await promoteContestantsToSegments(adminSupabase, contestantIds, [
        "round3_stage3",
      ]);

      return NextResponse.redirect(
        new URL("/admin/round3-results?done=stage12_to_top3", req.url)
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
