import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { adminSupabase } = auth;
  const body = await parseRequest(req);

  const action = String(body.action || "");
  const topN = Number(body.topN || 0);

  if (action === "round2_to_stage12") {
    const { data, error } = await adminSupabase.rpc("promote_round2_to_final", {
      p_top_n: topN || 10,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/admin/round3-results?done=round2_to_stage12", req.url));
  }

  if (action === "stage12_to_top3") {
    const { data, error } = await adminSupabase.rpc("promote_stage12_to_top3", {
      p_top_n: topN || 3,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/admin/round3-results?done=stage12_to_top3", req.url));
  }

  return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
}
