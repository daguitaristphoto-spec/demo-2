import Link from 'next/link';
import type { CSSProperties } from 'react';
import { requireRole } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type RoundJudge = {
  judge_id: string;
  profiles: Profile | Profile[] | null;
};

type AnyRow = Record<string, any>;

function normalizeProfile(profile: Profile | Profile[] | null): Profile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}

function getJudgeId(row: AnyRow): string | null {
  return row.judge_id ?? row.profile_id ?? row.user_id ?? null;
}

function isRound2(row: AnyRow): boolean {
  const value =
    row.round_number ??
    row.round ??
    row.round_id ??
    row.segment ??
    row.segment_id ??
    row.stage ??
    '';

  const text = String(value).toLowerCase();

  return (
    value === 2 ||
    text === '2' ||
    text.includes('round2') ||
    text.includes('round_2') ||
    text.includes('vong2') ||
    text.includes('vòng 2') ||
    text.includes('ban_ket') ||
    text.includes('bán kết')
  );
}

function isSubmitted(row: AnyRow): boolean {
  return Boolean(
    row.submitted_at ||
    row.completed_at ||
    row.finished_at ||
    row.locked_at ||
    row.finalized_at ||
    row.is_submitted ||
    row.submitted ||
    row.is_completed ||
    row.completed
  );
}

function getSubmittedTime(row: AnyRow): string {
  return (
    row.submitted_at ||
    row.completed_at ||
    row.finished_at ||
    row.locked_at ||
    row.finalized_at ||
    ''
  );
}

export default async function AdminRound2JudgeStatusPage() {
  await requireRole('admin');

  const supabase = await createClient();

  const { data: round2Judges, error: judgesError } = await supabase
    .from('round_judges')
    .select(`
      judge_id,
      profiles:judge_id (
        id,
        full_name,
        email
      )
    `)
    .eq('round_number', 2)
    .eq('is_active', true);

  if (judgesError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải danh sách giám khảo vòng 2</h1>
        <pre>{judgesError.message}</pre>
      </main>
    );
  }

  const { data: pairs } = await supabase
    .from('round2_pairs')
    .select('id');

  const { data: completions, error: completionsError } = await supabase
    .from('judge_round_completions')
    .select('*');

  if (completionsError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải trạng thái nộp điểm vòng 2</h1>
        <pre>{completionsError.message}</pre>
      </main>
    );
  }

  const { data: scoreSheets, error: scoreSheetsError } = await supabase
    .from('score_sheets')
    .select('*');

  if (scoreSheetsError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải phiếu điểm</h1>
        <pre>{scoreSheetsError.message}</pre>
      </main>
    );
  }

  const totalPairs = pairs?.length ?? 0;

  const round2CompletionRows = ((completions ?? []) as AnyRow[]).filter(isRound2);
  const round2ScoreSheetRows = ((scoreSheets ?? []) as AnyRow[]).filter(isRound2);

  const completedJudgeMap = new Map<string, AnyRow>();
  const submittedSheetCountMap = new Map<string, number>();

  for (const row of round2CompletionRows) {
    const judgeId = getJudgeId(row);
    if (!judgeId) continue;

    if (isSubmitted(row)) {
      completedJudgeMap.set(judgeId, row);
    }
  }

  for (const row of round2ScoreSheetRows) {
    const judgeId = getJudgeId(row);
    if (!judgeId) continue;

    if (isSubmitted(row)) {
      submittedSheetCountMap.set(
        judgeId,
        (submittedSheetCountMap.get(judgeId) ?? 0) + 1
      );
    }
  }

  const rows = ((round2Judges ?? []) as RoundJudge[]).map((item) => {
    const profile = normalizeProfile(item.profiles);
    const completedRow = completedJudgeMap.get(item.judge_id);
    const submittedSheetCount = submittedSheetCountMap.get(item.judge_id) ?? 0;

    const isCompleted = Boolean(completedRow) || submittedSheetCount > 0;

    return {
      judgeId: item.judge_id,
      fullName: profile?.full_name ?? 'Chưa có tên',
      email: profile?.email ?? '',
      submittedSheetCount,
      isCompleted,
      submittedTime: completedRow ? getSubmittedTime(completedRow) : '',
    };
  });

  const completedRows = rows.filter((row) => row.isCompleted);
  const missingRows = rows.filter((row) => !row.isCompleted);

  return (
    <main style={mainStyle}>
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Speak Up DNU 2026</p>
        <h1>Tiến độ chấm vòng 2</h1>
        <p>
          Theo dõi giám khảo vòng 2 nào đã nộp điểm và giám khảo nào chưa nộp điểm.
        </p>

        <p style={{ marginTop: 12 }}>
          <Link href="/admin/results">← Quay lại kết quả</Link>
        </p>
      </div>

      <section
        className="card-surface"
        style={{
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <div className="sidebar-label">Tổng giám khảo vòng 2</div>
          <strong style={{ fontSize: 28 }}>{rows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Đã nộp điểm</div>
          <strong style={{ fontSize: 28 }}>{completedRows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Chưa nộp điểm</div>
          <strong style={{ fontSize: 28 }}>{missingRows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Số cặp vòng 2</div>
          <strong style={{ fontSize: 28 }}>{totalPairs}</strong>
        </div>
      </section>

      <section className="card-surface" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Giám khảo</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Số phiếu đã nộp</th>
              <th style={thStyle}>Thời gian nộp</th>
              <th style={thStyle}>Trạng thái</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.judgeId}>
                <td style={tdStyle}>{row.fullName}</td>
                <td style={tdStyle}>{row.email}</td>
                <td style={tdStyle}>
                  {row.submittedSheetCount > 0
                    ? `${row.submittedSheetCount} phiếu`
                    : '—'}
                </td>
                <td style={tdStyle}>
                  {row.submittedTime
                    ? new Date(row.submittedTime).toLocaleString('vi-VN')
                    : '—'}
                </td>
                <td style={tdStyle}>
                  {row.isCompleted ? (
                    <span style={doneBadge}>Đã nộp điểm</span>
                  ) : (
                    <span style={missingBadge}>Chưa nộp điểm</span>
                  )}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td style={tdStyle} colSpan={5}>
                  Chưa có giám khảo nào được gán cho vòng 2 trong bảng round_judges.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {!!missingRows.length && (
        <section className="card-surface" style={{ padding: 20, marginTop: 20 }}>
          <h2>Giám khảo chưa nộp điểm vòng 2</h2>

          <ul>
            {missingRows.map((row) => (
              <li key={row.judgeId}>
                {row.fullName}
                {row.email ? ` — ${row.email}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const mainStyle: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: 24,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const doneBadge: CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(34,197,94,0.14)',
  color: '#86efac',
  fontWeight: 700,
};

const missingBadge: CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(250,204,21,0.14)',
  color: '#fde047',
  fontWeight: 700,
};
