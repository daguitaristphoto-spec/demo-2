import Link from 'next/link';
import type { CSSProperties } from 'react';
import { requireRole } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

type AnyRow = Record<string, any>;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type RoundJudge = {
  judge_id: string;
  profiles: Profile | Profile[] | null;
};

type Target = {
  pairId: string;
  pairLabel: string;
  contestantId: string;
  contestantNumber: string;
  contestantName: string;
};

function normalizeProfile(profile: Profile | Profile[] | null): Profile | null {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}

function getJudgeId(row: AnyRow): string | null {
  return row.judge_id ?? row.profile_id ?? row.user_id ?? row.judgeId ?? null;
}

function getPairId(row: AnyRow): string | null {
  return (
    row.pair_id ??
    row.round2_pair_id ??
    row.round_pair_id ??
    row.pairId ??
    null
  );
}

function getPairMemberId(row: AnyRow): string | null {
  return (
    row.pair_member_id ??
    row.round2_pair_member_id ??
    row.member_id ??
    row.round2_member_id ??
    null
  );
}

function getContestantId(row: AnyRow): string | null {
  return (
    row.contestant_id ??
    row.contestantId ??
    row.candidate_id ??
    row.target_contestant_id ??
    row.scored_contestant_id ??
    row.participant_id ??
    null
  );
}

function getScoreTargetContestantId(
  row: AnyRow,
  memberIdToContestantId: Map<string, string>
): string | null {
  const directContestantId = getContestantId(row);
  if (directContestantId) return directContestantId;

  const memberId = getPairMemberId(row);
  if (memberId) return memberIdToContestantId.get(memberId) ?? null;

  return null;
}

function getContestantNumber(row: AnyRow | undefined): string {
  if (!row) return '';
  return String(row.contestant_number ?? row.sbd ?? row.number ?? '');
}

function getContestantName(row: AnyRow | undefined): string {
  if (!row) return 'Không rõ tên';
  return String(row.full_name ?? row.name ?? row.contestant_name ?? 'Không rõ tên');
}

function getPairLabel(pair: AnyRow | undefined, fallbackIndex: number): string {
  if (!pair) return `Cặp ${fallbackIndex + 1}`;

  return String(
    pair.pair_number ??
      pair.code ??
      pair.name ??
      pair.label ??
      pair.order_index ??
      `Cặp ${fallbackIndex + 1}`
  );
}

function getMemberOrder(row: AnyRow): number {
  const value =
    row.member_order ??
    row.order_index ??
    row.position ??
    row.slot ??
    row.sort_order ??
    0;

  return Number(value) || 0;
}

function isRound2ScoreSheet(row: AnyRow): boolean {
  const value =
    row.round_number ??
    row.round ??
    row.round_id ??
    row.segment ??
    row.segment_id ??
    row.stage ??
    row.type ??
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

function formatTarget(target: Target): string {
  const numberText = target.contestantNumber
    ? `SBD ${target.contestantNumber} — `
    : '';

  return `${target.pairLabel}: ${numberText}${target.contestantName}`;
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

  const { data: pairMembers, error: pairMembersError } = await supabase
    .from('round2_pair_members')
    .select('*');

  if (pairMembersError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải danh sách thí sinh vòng 2</h1>
        <pre>{pairMembersError.message}</pre>
      </main>
    );
  }

  const { data: pairs } = await supabase
    .from('round2_pairs')
    .select('*');

  const { data: contestants, error: contestantsError } = await supabase
    .from('contestants')
    .select('*');

  if (contestantsError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải danh sách thí sinh</h1>
        <pre>{contestantsError.message}</pre>
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

  const contestantsById = new Map<string, AnyRow>();
  for (const contestant of (contestants ?? []) as AnyRow[]) {
    if (contestant.id) {
      contestantsById.set(contestant.id, contestant);
    }
  }

  const pairsById = new Map<string, AnyRow>();
  for (const pair of (pairs ?? []) as AnyRow[]) {
    if (pair.id) {
      pairsById.set(pair.id, pair);
    }
  }

  const sortedPairMembers = [...((pairMembers ?? []) as AnyRow[])].sort((a, b) => {
    const pairA = String(getPairId(a) ?? '');
    const pairB = String(getPairId(b) ?? '');

    if (pairA !== pairB) return pairA.localeCompare(pairB);

    return getMemberOrder(a) - getMemberOrder(b);
  });

  const memberIdToContestantId = new Map<string, string>();

  for (const member of sortedPairMembers) {
    const memberId = member.id;
    const contestantId = getContestantId(member);

    if (memberId && contestantId) {
      memberIdToContestantId.set(memberId, contestantId);
    }
  }

  const targets: Target[] = sortedPairMembers
    .map((member, index) => {
      const pairId = getPairId(member);
      const contestantId = getContestantId(member);

      if (!pairId || !contestantId) return null;

      const contestant = contestantsById.get(contestantId);
      const pair = pairsById.get(pairId);

      return {
        pairId,
        pairLabel: getPairLabel(pair, index),
        contestantId,
        contestantNumber: getContestantNumber(contestant),
        contestantName: getContestantName(contestant),
      };
    })
    .filter((target): target is Target => Boolean(target));

  const targetIds = new Set(targets.map((target) => target.contestantId));

  const submittedByJudge = new Map<string, Set<string>>();

  for (const sheet of (scoreSheets ?? []) as AnyRow[]) {
    const judgeId = getJudgeId(sheet);
    if (!judgeId) continue;

    const targetContestantId = getScoreTargetContestantId(
      sheet,
      memberIdToContestantId
    );

    if (!targetContestantId) continue;
    if (!targetIds.has(targetContestantId)) continue;

    const looksLikeRound2 = isRound2ScoreSheet(sheet) || targetIds.has(targetContestantId);
    if (!looksLikeRound2) continue;

    if (!submittedByJudge.has(judgeId)) {
      submittedByJudge.set(judgeId, new Set());
    }

    submittedByJudge.get(judgeId)?.add(targetContestantId);
  }

  const rows = ((round2Judges ?? []) as unknown as RoundJudge[]).map((item) => {
    const profile = normalizeProfile(item.profiles);
    const submittedTargetIds = submittedByJudge.get(item.judge_id) ?? new Set();

    const submittedTargets = targets.filter((target) =>
      submittedTargetIds.has(target.contestantId)
    );

    const missingTargets = targets.filter(
      (target) => !submittedTargetIds.has(target.contestantId)
    );

    const isCompleted = targets.length > 0 && missingTargets.length === 0;

    return {
      judgeId: item.judge_id,
      fullName: profile?.full_name ?? 'Chưa có tên',
      email: profile?.email ?? '',
      submittedCount: submittedTargets.length,
      missingCount: missingTargets.length,
      missingTargets,
      isCompleted,
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
          Theo dõi chi tiết giám khảo nào còn thiếu điểm của thí sinh nào trong vòng 2.
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
          <div className="sidebar-label">Đã chấm đủ</div>
          <strong style={{ fontSize: 28 }}>{completedRows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Chưa chấm đủ</div>
          <strong style={{ fontSize: 28 }}>{missingRows.length}</strong>
        </div>

        <div>
          <div className="sidebar-label">Số thí sinh vòng 2</div>
          <strong style={{ fontSize: 28 }}>{targets.length}</strong>
        </div>
      </section>

      <section className="card-surface" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Giám khảo</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Đã chấm</th>
              <th style={thStyle}>Còn thiếu</th>
              <th style={thStyle}>Trạng thái</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.judgeId}>
                <td style={tdStyle}>{row.fullName}</td>
                <td style={tdStyle}>{row.email}</td>
                <td style={tdStyle}>
                  {row.submittedCount}/{targets.length} thí sinh
                </td>
                <td style={tdStyle}>
                  {row.missingCount > 0 ? `${row.missingCount} thí sinh` : '—'}
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
                <td style={tdStyle} colSpan={5}>
                  Chưa có giám khảo nào được gán cho vòng 2 trong bảng round_judges.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card-surface" style={{ padding: 20, marginTop: 20 }}>
        <h2>Chi tiết giám khảo còn thiếu điểm</h2>

        {!targets.length && (
          <p>
            Chưa đọc được danh sách thí sinh vòng 2 từ bảng{' '}
            <code>round2_pair_members</code>. Cần kiểm tra lại bảng ghép cặp vòng 2.
          </p>
        )}

        {!!targets.length && !missingRows.length && (
          <p>Tất cả giám khảo vòng 2 đã chấm đủ.</p>
        )}

        {!!targets.length && !!missingRows.length && (
          <div style={{ display: 'grid', gap: 16 }}>
            {missingRows.map((row) => (
              <div
                key={row.judgeId}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                  {row.fullName}
                </h3>

                {row.email && (
                  <p style={{ marginTop: 0, opacity: 0.8 }}>{row.email}</p>
                )}

                <p>
                  Đã chấm <strong>{row.submittedCount}</strong>/
                  <strong>{targets.length}</strong> thí sinh. Còn thiếu{' '}
                  <strong>{row.missingCount}</strong> thí sinh:
                </p>

                <ul style={{ marginBottom: 0 }}>
                  {row.missingTargets.map((target) => (
                    <li key={`${row.judgeId}-${target.contestantId}`}>
                      {formatTarget(target)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const mainStyle: CSSProperties = {
  maxWidth: 1180,
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
