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

async function getContestantsByIds(adminSupabase: any, contestantIds: string[]) {
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

  return new Map((data || []).map((contestant: any) => [String(contestant.id), contestant]));
}

async function getRound2ContestantIds(adminSupabase: any) {
  const { data: pairs, error: pairsError } = await adminSupabase
    .from("round2_pairs")
    .select("id")
    .eq("segment_id", "round2_semifinal");

  if (pairsError) {
    throw new Error(pairsError.message);
  }

  const pairIds = (pairs || []).map((pair: any) => pair.id);

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

  const contestantIds = Array.from(
    new Set((members || []).map((member: any) => String(member.contestant_id)))
  );

  if (contestantIds.length === 0) {
    throw new Error("Chưa có thí sinh trong các cặp vòng 2.");
  }

  return contestantIds;
}

async function getSegmentContestantIds(adminSupabase: any, segmentIds: string[]) {
  const { data, error } = await
