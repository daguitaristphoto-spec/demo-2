import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

type JudgeProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type RoundJudgeRow = {
  judge_id: string;
  profiles: JudgeProfile | JudgeProfile[] | null;
};

type Round2Pair = {
  id: string;
};

type Round2Score = {
  judge_id: string;
  pair_id: string;
  submitted_at: string | null;
};

function normalizeProfile(profile: JudgeProfile | JudgeProfile[] | null): JudgeProfile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
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
    .eq('is_active', true)
    .order('judge_id');

  if (judgesError) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <h1>Lỗi tải danh sách giám khảo vòng 2</h1>
        <pre>{judgesError.message}</pre>
      </main>
    );
  }

  const { data: pairs, error: pairsError } = await supabase
    .from('round2_pairs')
    .select('id');

  if (pairsError) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <h1>Lỗi tải danh sách cặp thi vòng 2</h1>
        <pre>{pairsError.message}</pre>
      </main>
    );
  }

  const { data: scores, error: scoresError } = await supabase
    .from('round2_scores')
    .select('judge_id, pair_id, submitted_at')
    .not('submitted_at', 'is', null);

  if (scoresError) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <h1>Lỗi tải điểm vòng 2</h1>
        <pre>{scoresError.message}</pre>
        <p>
          Nếu bảng điểm vòng 2 của bạn không tên là <code>round2_scores</code>,
          cần đổi lại tên bảng trong file này.
        </p>
      </main>
    );
  }

  const totalPairs = pairs?.length ?? 0;

  const submittedMap = new Map<string, Set<string>>();

  for (const score of (scores ?? []) as Round2Score[]) {
    if (!score.judge_id || !score.pair_id) continue;

    if (!submittedMap.has(score.judge_id)) {
      submittedMap.set(score.judge_id, new Set());
    }

    submittedMap.get(score.judge_id)?.add(score.pair_id);
  }

  const rows = ((round2Judges ?? []) as RoundJudgeRow[]).map((item) => {
    const profile = normalizeProfile(item.profiles);
    const submittedPairCount = submittedMap.get(item.judge_id)?.size ?? 0;
    const isCompleted = totalPairs > 0 && submittedPairCount >= totalPairs;

    return {
      judgeId: item.judge_id,
      fullName: profile?.full_name ?? 'Chưa có tên',
      email: profile?.email ?? '',
      submittedPairCount,
      totalPairs,
      isCompleted,
    };
  });

  const completedCount = rows.filter((row) => row.isCompleted).length;
  const missingRows = rows.filter((row) => !row.isCompleted);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Speak Up DNU 2026</p>
        <h1>Tiến độ chấm vòng 2</h1>
        <p>
          Theo dõi giám khảo nào đã chốt điểm và giám khảo nào chưa chấm đủ các cặp thi vòng 2.
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
          <div className="sidebar-label">Tổng số giám khảo vòng 2</div>
          <strong style={{ fontSize: 28 }}>{rows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Đã chấm đủ</div>
          <strong style={{ fontSize: 28 }}>{completedCount}</strong>
        </div>

        <div>
          <div className="sidebar-label">Chưa chấm đủ</div>
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
              <th style={thStyle}>Tiến độ</th>
              <th style={thStyle}>Trạng thái</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.judgeId}>
                <td style={tdStyle}>{row.fullName}</td>
                <td style={tdStyle}>{row.email}</td>
                <td style={tdStyle}>
                  {row.submittedPairCount}/{row.totalPairs} cặp
                </td>
                <td style={tdStyle}>
                  {row.isCompleted ? (
                    <span style={doneBadge}>Đã chấm đủ</span>
                  ) : (
                    <span style={missingBadge}>Chưa chấm đủ</span>
                  )}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td style={tdStyle} colSpan={4}>
                  Chưa có giám khảo nào được gán cho vòng 2.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {!!missingRows.length && (
        <section className="card-surface" style={{ padding: 20, marginTop: 20 }}>
          <h2>Danh sách giám khảo chưa chấm đủ</h2>

          <ul>
            {missingRows.map((row) => (
              <li key={row.judgeId}>
                {row.fullName}
                {row.email ? ` — ${row.email}` : ''}:
                {' '}
                đã chấm {row.submittedPairCount}/{row.totalPairs} cặp
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const doneBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(34,197,94,0.14)',
  color: '#86efac',
  fontWeight: 700,
};

const missingBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(250,204,21,0.14)',
  color: '#fde047',
  fontWeight: 700,
};
