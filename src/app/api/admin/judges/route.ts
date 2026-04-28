// API phụ trợ: lấy danh sách tài khoản giám khảo.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("role", "judge")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ judges: data || [] });
}
