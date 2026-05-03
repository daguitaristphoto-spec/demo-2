import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Row = Record<string, any>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const ROUND1_KEYS = ['round1_online', 'round1', 'vong1', 'vòng 1'];

const META_SCORE_KEYS = new Set([
  'id',
  'judge_id',
  'judgeid',
  'contestant_id',
  'contestantid',
  'segment_id',
  'segmentid',
  'round_id',
  'roundid',
  'round',
  'status',
  'total_score',
  'totalscore',
  'final_score',
  'finalscore',
  'total',
  'score',
  'created_at',
  'createdat',
  'updated_at',
  'updatedat',
  'submitted_at',
  'submittedat',
]);

const CRITERION_LABELS: Record<string, string> = {
  content: 'Nội dung',
  topic: 'Chủ đề/Nội dung',
  message: 'Thông điệp',
  structure: 'Bố cục',
  language: 'Ngôn ngữ',
  voice: 'Giọng nói',
  pronunciation: 'Phát âm',
  intonation: 'Ngữ điệu',
  fluency: 'Độ lưu loát',
  style: 'Phong thái',
  confidence: 'Sự tự tin',
  creativity: 'Sáng tạo',
  interaction: 'Tương tác',
  body_language: 'Ngôn ngữ cơ thể',
  stage_presence: 'Làm chủ sân khấu',
  performance: 'Trình bày/Thể hiện',
  overall: 'Đánh giá tổng thể',
};

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function labelFromKey(key: string) {
  const normalized = normalizeKey(key)
    .replace(/^score_/, '')
    .replace(/_score$/, '')
    .replace(/^diem_/, '')
    .replace(/_diem$/, '');

  return (
    CRITERION_LABELS[normalized] ||
    normalized
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') ||
    key
  );
}

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

function extractFirstUrl(row: Row | undefined) {
  if (!row) return '';

  const priorityKeys = [
    'video_url',
    'videoUrl',
    'drive_video_url',
    'driveVideoUrl',
    'video_drive_url',
    'videoDriveUrl',
    'google_drive_url',
    'googleDriveUrl',
    'drive_url',
    'driveUrl',
    'video_link',
    'videoLink',
    'submission_video_url',
    'submissionVideoUrl',
    'file_url',
    'fileUrl',
    'public_url',
    'publicUrl',
    'url',
    'link',
  ];

  const directValue = readText(row, priorityKeys);

  if (directValue) return directValue;

  for (const value of Object.values(row)) {
    if (typeof value !== 'string') continue;

    const match = value.match(/https?:\/\/[^\s"']+/);

    if (match?.[0]) {
      return match[0];
    }
  }

  const fileId = readText(row, [
    'google_drive_file_id',
    'googleDriveFileId',
    'drive_file_id',
    'driveFileId',
    'video_file_id',
    'videoFileId',
  ]);

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  return '';
}

function normalizeItems(value: unknown): Row[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          return item as Row;
        }

        return {
          key: `item_${index + 1}`,
          score: item,
        };
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeItems(parsed);
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    const objectValue = value as Row;

    return Object.entries(objectValue).map(([key, score]) => {
      if (typeof score === 'object' && score !== null) {
        return {
          key,
          ...(score as Row),
        };
      }

      return {
        key,
        score,
      };
    });
  }

  return [];
}

function convertRawItemsToScoreItems(items: Row[], sheetId: string) {
  return items
    .map((item, index) => {
      const key = readText(item, [
        'criterion_key',
        'criteria_key',
        'item_key',
        'key',
        'criterion_id',
        'criterionId',
        'id',
        'name',
      ]);

      const label =
        readText(item, [
          'criterion_label',
          'criteria_label',
          'label',
          'title',
          'name',
        ]) || labelFromKey(key || `Tiêu chí ${index + 1}`);

      const score = readNumber(item, [
        'score',
        'point',
        'points',
        'value',
        'diem',
        'mark',
        'marks',
      ]);

      return {
        id: String(item.id ?? `${sheetId}-${index}`),
        key,
        label,
        score,
        maxScore: readNumber(item, [
          'max_score',
          'max',
          'maximum_score',
          'maxScore',
        ]),
        note: readText(item, ['note', 'notes', 'comment', 'comments']),
      };
    })
    .filter((item) => item.score !== null);
}

function extractScoreItems(sheet: Row) {
  const sheetId = String(sheet.id ?? 'sheet');

  const possibleItemFields = [
    'items',
    'score_items',
    'scoreItems',
    'scores',
    'criteria_scores',
    'criteriaScores',
    'criterion_scores',
    'criterionScores',
    'rubric_scores',
    'rubricScores',
    'score_details',
    'scoreDetails',
    'details',
    'payload',
    'answers',
    'result',
    'results',
    'breakdown',
    'score_breakdown',
    'scoreBreakdown',
    'criteria',
  ];

  for (const field of possibleItemFields) {
    const items = normalizeItems(sheet[field]);
    const converted = convertRawItemsToScoreItems(items, sheetId);

    if (converted.length > 0) {
      return converted;
    }
  }

  for (const [field, value] of Object.entries(sheet)) {
    if (
      value &&
      (Array.isArray(value) ||
        typeof value === 'object' ||
        (typeof value === 'string' &&
          (value.trim().startsWith('{') || value.trim().startsWith('['))))
    ) {
      const items = normalizeItems(value);
      const converted = convertRawItemsToScoreItems(items, sheetId);

      if (converted.length > 1) {
        return converted;
      }
    }
  }

  const numericCriteria = Object.entries(sheet)
    .filter(([key, value]) => {
      const normalizedKey = normalizeKey(key);

      if (META_SCORE_KEYS.has(normalizedKey)) return false;
      if (normalizedKey.includes('id')) return false;
      if (normalizedKey.includes('time')) return false;
      if (normalizedKey.includes('date')) return false;
      if (normalizedKey.includes('at')) return false;

      const numberValue = Number(value);

      if (Number.isNaN(numberValue)) return false;

      return (
        normalizedKey.includes('score') ||
        normalizedKey.includes('diem') ||
        normalizedKey.includes('point') ||
        normalizedKey.includes('content') ||
        normalizedKey.includes('voice') ||
        normalizedKey.includes('pronunciation') ||
        normalizedKey.includes('style') ||
        normalizedKey.includes('confidence') ||
        normalizedKey.includes('creativity') ||
        normalizedKey.includes('language') ||
        normalizedKey.includes('overall')
      );
    })
    .map(([key, value]) => ({
      id: `${sheetId}-${key}`,
      key,
      label: labelFromKey(key),
      score: Number(value),
      maxScore: null,
      note: '',
    }));

  return numericCriteria;
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

  const sheetsByContestantId = new Map<string, Row[]>();

  sheetRows.forEach((sheet) => {
    const contestantId = String(sheet.contestant_id ?? '');

    if (!contestantId) return;

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
        videoUrl: extractFirstUrl(contestant),
        sheets: sheets
          .map((sheet) => {
            const judgeId = String(sheet.judge_id ?? sheet.judgeId ?? '');
            const judge = judgesById.get(judgeId);
            const items = extractScoreItems(sheet);

            const totalScore =
              readNumber(sheet, [
                'total_score',
                'final_score',
                'total',
                'score',
              ]) ??
              (items.length
                ? items.reduce((sum, item) => sum + (item.score ?? 0), 0)
                : null);

            return {
              id: String(sheet.id),
              judgeId,
              judgeName: readText(
                judge,
                ['full_name', 'name', 'display_name', 'email'],
                'Giám khảo chưa rõ tên'
              ),
              judgeEmail: readText(judge, ['email']),
              status: readText(sheet, ['status'], 'not_started'),
              totalScore,
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
              items,
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
