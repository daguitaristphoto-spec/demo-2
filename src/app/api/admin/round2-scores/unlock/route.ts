import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Chỉ admin mới được mở khóa điểm vòng 2" },
      { status: 403 }
    );
  }

  const { data, error } = await adminSupabase
    .from("score_sheets")
    .update({
      status: "draft",
      submitted_at: null,
      can_edit: true,
      updated_at: new Date().toISOString(),
    })
    .eq("segment_id", "round2_semifinal")
    .in("status", ["submitted", "locked"])
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    unlockedCount: data?.length || 0,
  });
}
