import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contestantId: string }> }
) {
  const { contestantId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();

  const { data: contestant } = await supabase
    .from('contestants')
    .select('id, video_path')
    .eq('id', contestantId)
    .single();

  if (!contestant?.video_path) {
    return NextResponse.json({ error: 'Video chưa tồn tại' }, { status: 404 });
  }

  if (profile?.role !== 'admin') {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('judge_id')
      .eq('contestant_id', contestantId)
      .single();

    if (!assignment || assignment.judge_id !== authData.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const admin = createAdminClient();
  const bucket = process.env.NEXT_PUBLIC_VIDEO_BUCKET || 'contestant-videos';
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(contestant.video_path, 600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Không tạo được signed URL' }, { status: 400 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
