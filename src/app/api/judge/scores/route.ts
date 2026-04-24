import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateRound1Score } from '@/lib/scoring';
import type { ScoreItemInput } from '@/lib/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
  if (profile?.role !== 'judge') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as {
    contestantId?: string;
    action?: 'save' | 'submit';
    strengths?: string;
    weaknesses?: string;
    items?: ScoreItemInput[];
  };

  if (!body.contestantId || !body.items?.length) {
    return NextResponse.json({ error: 'Thiếu dữ liệu chấm điểm' }, { status: 400 });
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('judge_id, can_edit')
    .eq('contestant_id', body.contestantId)
    .single();

  if (!assignment || assignment.judge_id !== authData.user.id) {
    return NextResponse.json({ error: 'Bạn không được chấm thí sinh này' }, { status: 403 });
  }

  if (!assignment.can_edit) {
    return NextResponse.json({ error: 'Phiếu đã khóa. Vui lòng nhờ admin mở lại.' }, { status: 400 });
  }

  const scoreResult = calculateRound1Score(body.items);

  const { data: existingSheet } = await supabase
    .from('score_sheets')
    .select('id, status')
    .eq('contestant_id', body.contestantId)
    .eq('judge_id', authData.user.id)
    .maybeSingle();

  let scoreSheetId = existingSheet?.id;

  if (!scoreSheetId) {
    const { data: inserted, error: insertError } = await supabase
      .from('score_sheets')
      .insert({
        contestant_id: body.contestantId,
        judge_id: authData.user.id,
        strengths: body.strengths ?? '',
        weaknesses: body.weaknesses ?? '',
        total_score: scoreResult.final100,
        status: body.action === 'submit' ? 'submitted' : 'draft',
        submitted_at: body.action === 'submit' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message ?? 'Không tạo được phiếu chấm' }, { status: 400 });
    }

    scoreSheetId = inserted.id;
  } else {
    const { error: updateError } = await supabase
      .from('score_sheets')
      .update({
        strengths: body.strengths ?? '',
        weaknesses: body.weaknesses ?? '',
        total_score: scoreResult.final100,
        status: body.action === 'submit' ? 'submitted' : 'draft',
        submitted_at: body.action === 'submit' ? new Date().toISOString() : null,
      })
      .eq('id', scoreSheetId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  if (!scoreSheetId) {
    return NextResponse.json({ error: 'Không xác định được scoreSheetId' }, { status: 400 });
  }

  const deleteOld = await supabase.from('score_items').delete().eq('score_sheet_id', scoreSheetId);
  if (deleteOld.error) {
    return NextResponse.json({ error: deleteOld.error.message }, { status: 400 });
  }

  const itemRows = body.items.map((item) => ({
    score_sheet_id: scoreSheetId,
    criterion_key: item.criterionKey,
    criterion_group: item.criterionGroup,
    score: item.score,
  }));

  const { error: itemsError } = await supabase.from('score_items').insert(itemRows);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  if (body.action === 'submit') {
    const { error: lockError } = await supabase
      .from('assignments')
      .update({ can_edit: false })
      .eq('contestant_id', body.contestantId)
      .eq('judge_id', authData.user.id);

    if (lockError) {
      return NextResponse.json({ error: lockError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, finalScore: scoreResult.final100, classification: scoreResult.classification });
}
