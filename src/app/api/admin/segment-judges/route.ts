// API admin phân công giám khảo theo vòng/chặng.
// GET  /api/admin/segment-judges?segmentId=round2_semifinal
// POST /api/admin/segment-judges
// Body POST:
// {
//   "segmentId": "round2_semifinal",
//   "judgeIds": ["uuid-1", "uuid-2"],
//   "replace": true
// }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Chỉ admin mới được phân công giám khảo" }, { status: 403 }) };
  }

  return { user, profile };
}

export async function GET(req: Request) {
 const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const segmentId = searchParams.get("segmentId");

  if (!segmentId) {
    return NextResponse.json({ error: "Thiếu segmentId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("v_segment_judges")
    .select("*")
    .eq("segment_id", segmentId)
    .eq("is_active", true)
    .order("judge_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ judges: data || [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const segmentId = body.segmentId;
  const judgeIds = body.judgeIds || [];
  const replace = body.replace ?? true;

  if (!segmentId) {
    return NextResponse.json({ error: "Thiếu segmentId" }, { status: 400 });
  }

  if (!Array.isArray(judgeIds)) {
    return NextResponse.json({ error: "judgeIds phải là mảng" }, { status: 400 });
  }

  const { error } = await supabase.rpc("assign_judges_to_segment", {
    p_segment_id: segmentId,
    p_judge_ids: judgeIds,
    p_replace: replace,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
