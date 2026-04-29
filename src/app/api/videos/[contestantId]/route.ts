import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function getGoogleDriveFileId(value: string) {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/i,
    /drive\.google\.com\/open\?id=([^&]+)/i,
    /drive\.google\.com\/uc\?id=([^&]+)/i,
    /drive\.google\.com\/drive\/folders\/([^/?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  try {
    const url = new URL(value);
    const id = url.searchParams.get('id');

    if (id) {
      return id;
    }
  } catch {
    return null;
  }

  return null;
}

function getGoogleDrivePreviewUrl(value: string) {
  const fileId = getGoogleDriveFileId(value);

  if (!fileId) {
    return null;
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

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

  const videoPath = String(contestant.video_path).trim();

  if (isHttpUrl(videoPath)) {
    const googleDrivePreviewUrl = getGoogleDrivePreviewUrl(videoPath);

    if (googleDrivePreviewUrl) {
      return NextResponse.json({
        url: googleDrivePreviewUrl,
        originalUrl: videoPath,
        kind: 'google_drive',
      });
    }

    return NextResponse.json({
      url: videoPath,
      originalUrl: videoPath,
      kind: 'direct_url',
    });
  }

  const admin = createAdminClient();
  const bucket = process.env.NEXT_PUBLIC_VIDEO_BUCKET || 'contestant-videos';

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(videoPath, 600);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? 'Không tạo được signed URL' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    originalUrl: videoPath,
    kind: 'storage',
  });
}
