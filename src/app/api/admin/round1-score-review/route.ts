import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Row = Record<string, any>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const ROUND1_KEYS = ['round1_online', 'round1', 'vong1', 'vòng 1'];

function readText(row: Row | undefined, keys: string[], fallback = '') {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  return fallback;
}

function readNumber(row: Row | undefined, keys: string[]) {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      const numberValue = Number(value);
      return Number.isNaN(numberValue) ? null : numberValue;
    }
  }

  return null;
}

async function loadRound1ScoreSheets(supabase: SupabaseServerClient) {
  const attempts = [
    { column: 'segment_id', value: 'round1_online' },
    { column: 'round_id', value: 'round1' },
    { column: 'round', value: 'round1' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('score_sheets')
      .select('*')
      .eq(attempt.column, attempt.value);

    if (!error) {
      return data ?? [];
    }
  }

  const { data, error } = await supabase.from('score_sheets').select('*');

  if (error) {
    throw error;
  }

  return (data ?? []).filter((sheet) => {
    const roundValue = String(
      sheet.segment_id ?? sheet.round_id ?? sheet.round ?? ''
    ).toLowerCase();

    return ROUND1_KEYS.includes(roundValue);
  });
}

export async function GET() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: contestantRows, error: contestantsError } = await supabase
    .from('contestants')
    .select('*');

  if (contestantsError) {
    return NextResponse.json(
      { error: contestantsError.message },
      { status: 500 }
    );
  }

  let sheetRows: Row[] = [];

  try {
    sheetRows = await loadRound1ScoreSheets(supabase);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Không tải được phiếu chấm vòng 1',
      },
      { status: 500 }
    );
  }

  const sheetIds = sheetRows.map((sheet) => sheet.id).filter(Boolean);

  let scoreRows: Row[] = [];

  if (sheetIds.length > 0) {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .in('score_sheet_id', sheetIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    scoreRows = data ?? [];
  }

  const judgeIds = Array.from(
    new Set(
      sheetRows
        .map((sheet) => sheet.judge_id ?? sheet.judgeId)
        .filter(Boolean)
    )
  );

  let judgeRows: Row[] = [];

  if (judgeIds.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', judgeIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    judgeRows = data ?? [];
  }

  const judgesById = new Map<string, Row>();
  judgeRows.forEach((judge) => {
    judgesById.set(String(judge.id), judge);
  });

  const scoresBySheetId = new Map<string, Row[]>();

  scoreRows.forEach((score) => {
    const sheetId = String(score.score_sheet_id ?? '');
    if (!scoresBySheetId.has(sheetId)) {
      scoresBySheetId.set(sheetId, []);
    }
    scoresBySheetId.get(sheetId)?.push(score);
  });

  const sheetsByContestantId = new Map<string, Row[]>();

  sheetRows.forEach((sheet) => {
    const contestantId = String(sheet.contestant_id ?? '');
    if (!sheetsByContestantId.has(contestantId)) {
      sheetsByContestantId.set(contestantId, []);
    }
    sheetsByContestantId.get(contestantId)?.push(sheet);
  });

  const contestants = (contestantRows ?? [])
    .map((contestant) => {
      const contestantId = String(contestant.id);
      const sheets = sheetsByContestantId.get(contestantId) ?? [];

      return {
        id: contestantId,
        code: readText(contestant, [
          'contestant_code',
          'contestant_number',
          'code',
          'sbd',
          'number',
        ]),
        name: readText(contestant, [
          'full_name',
          'name',
          'contestant_name',
          'display_name',
        ]),
        unit: readText(contestant, [
          'unit',
          'class_name',
          'class',
          'department',
          'organization',
        ]),
        videoUrl: readText(contestant, [
          'drive_video_url',
          'google_drive_url',
          'video_url',
          'video_link',
          'video',
        ]),
        sheets: sheets
          .map((sheet) => {
            const judgeId = String(sheet.judge_id ?? sheet.judgeId ?? '');
            const judge = judgesById.get(judgeId);
            const itemRows = scoresBySheetId.get(String(sheet.id)) ?? [];

            return {
              id: String(sheet.id),
              judgeId,
              judgeName: readText(judge, [
                'full_name',
                'name',
                'display_name',
                'email',
              ], 'Giám khảo chưa rõ tên'),
              judgeEmail: readText(judge, ['email']),
              status: readText(sheet, ['status'], 'not_started'),
              totalScore: readNumber(sheet, [
                'total_score',
                'final_score',
                'total',
                'score',
              ]),
              strengths: readText(sheet, [
                'strengths',
                'strength',
                'comment_strengths',
              ]),
              weaknesses: readText(sheet, [
                'weaknesses',
                'weakness',
                'comment_weaknesses',
              ]),
              generalComment: readText(sheet, [
                'comment',
                'comments',
                'note',
                'notes',
                'feedback',
              ]),
              submittedAt: readText(sheet, [
                'submitted_at',
                'submittedAt',
                'updated_at',
                'created_at',
              ]),
              items: itemRows.map((item) => ({
                id: String(item.id),
                key: readText(item, [
                  'criterion_key',
                  'criteria_key',
                  'item_key',
                  'key',
                  'criterion_id',
                ]),
                label: readText(item, [
                  'criterion_label',
                  'criteria_label',
                  'label',
                  'name',
                  'title',
                ]),
                score: readNumber(item, [
                  'score',
                  'point',
                  'points',
                  'value',
                ]),
                maxScore: readNumber(item, [
                  'max_score',
                  'max',
                  'maximum_score',
                ]),
                note: readText(item, [
                  'note',
                  'notes',
                  'comment',
                  'comments',
                ]),
              })),
            };
          })
          .sort((a, b) => a.judgeName.localeCompare(b.judgeName, 'vi')),
      };
    })
    .sort((a, b) => {
      const byCode = a.code.localeCompare(b.code, 'vi', { numeric: true });
      if (byCode !== 0) return byCode;
      return a.name.localeCompare(b.name, 'vi');
    });

  return NextResponse.json({ contestants });
}
