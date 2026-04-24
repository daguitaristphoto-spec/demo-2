import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const body = await request.json();
  const { contestantId, judgeId } = body as { contestantId?: string; judgeId?: string };

  if (!contestantId || !judgeId) {
    return NextResponse.json({ error: 'Thiếu contestantId hoặc judgeId' }, { status: 400 });
  }

  const { error } = await supabase.from('assignments').upsert({
    contestant_id: contestantId,
    judge_id: judgeId,
    assigned_by: authData.user.id,
    can_edit: true,
  }, { onConflict: 'contestant_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
