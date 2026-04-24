import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { contestantId, filename } = (await request.json()) as { contestantId?: string; filename?: string };
  if (!contestantId || !filename) {
    return NextResponse.json({ error: 'Thiếu contestantId hoặc filename' }, { status: 400 });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = safeFilename.split('.').pop() || 'mp4';
  const path = `round1/${contestantId}/${Date.now()}.${ext}`;
  const bucket = process.env.NEXT_PUBLIC_VIDEO_BUCKET || 'contestant-videos';

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Không tạo được signed upload URL' }, { status: 400 });
  }

  return NextResponse.json({ path, token: data.token });
}
