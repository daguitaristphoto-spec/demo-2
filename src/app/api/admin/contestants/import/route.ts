import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ContestantImportRow } from '@/lib/import-contestants';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as { rows?: ContestantImportRow[] };
  const rows = body.rows ?? [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Không có dữ liệu import.' }, { status: 400 });
  }

  const sanitizedRows = rows
    .map((row) => ({
      sbd: String(row.sbd ?? '').trim(),
      full_name: String(row.full_name ?? '').trim(),
      video_path: row.video_path?.trim() || undefined,
      profile_text: row.profile_text?.trim() || undefined,
      portrait_url: row.portrait_url?.trim() || undefined,
    }))
    .filter((row) => row.sbd && row.full_name);

  if (!sanitizedRows.length) {
    return NextResponse.json({ error: 'Không có dòng hợp lệ để import.' }, { status: 400 });
  }

  const sbds = sanitizedRows.map((row) => row.sbd);

  const { data: existingContestants, error: existingError } = await supabase
    .from('contestants')
    .select('sbd')
    .in('sbd', sbds);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const existingSet = new Set((existingContestants ?? []).map((item) => item.sbd));

  const importRows = sanitizedRows.map((row) => ({
    sbd: row.sbd,
    full_name: row.full_name,
    ...(row.video_path ? { video_path: row.video_path } : {}),
    ...(row.profile_text ? { profile_text: row.profile_text } : {}),
    ...(row.portrait_url ? { portrait_url: row.portrait_url } : {}),
  }));

  const { error: upsertError } = await supabase
    .from('contestants')
    .upsert(importRows, { onConflict: 'sbd' });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  const updated = sanitizedRows.filter((row) => existingSet.has(row.sbd)).length;
  const inserted = sanitizedRows.length - updated;

  return NextResponse.json({
    ok: true,
    total: sanitizedRows.length,
    inserted,
    updated,
  });
}
