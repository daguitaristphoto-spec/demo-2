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

  const { contestantId } = (await request.json()) as { contestantId?: string };
  if (!contestantId) {
    return NextResponse.json({ error: 'Thiếu contestantId' }, { status: 400 });
  }

  const { error } = await supabase
    .from('assignments')
    .update({ can_edit: true })
    .eq('contestant_id', contestantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
