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
  targetId: string;
  targetType: 'contestant' | 'pair';
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

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function hasKeyword(key: string, keywords: string[]) {
  const lowerKey = key.toLowerCase();
  return keywords.some((keyword) => lowerKey.includes(keyword));
}

function findMatchingValue(
  row: AnyRow,
  allowedValues: Set<string>,
  preferredKeywords: string[]
): string | null {
  for (const [key, value] of Object.entries(row)) {
    const text = valueToString(value);
    if (!text) continue;

    if (hasKeyword(key, preferredKeywords) && allowedValues.has(text)) {
      return text;
    }
  }

  for (const [, value] of Object.entries(row)) {
    const text = valueToString(value);
    if (!text) continue;

    if (allowedValues.has(text)) {
      return text;
    }
  }

  return null;
}

function normalizeName(row: AnyRow | undefined): string {
  if (!row) return 'Không rõ tên';

  return String(
    row.full_name ??
      row.name ??
      row.contestant_name ??
      row.display_name ??
      'Không rõ tên'
  );
}

function normalizeNumber(row: AnyRow | undefined): string {
  if (!row) return '';

  return String(
    row.contestant_number ??
      row.sbd ??
      row.number ??
      row.code ??
      ''
  );
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

function rowHasRoundInfo(row: AnyRow): boolean {
  return Object.keys(row).some((key) => {
    const lowerKey = key.toLowerCase();

    return (
      lowerKey.includes('round') ||
      lowerKey.includes('segment') ||
      lowerKey.includes('stage')
    );
  });
}

function isRound2Row(row: AnyRow): boolean {
  const values = Object.entries(row)
    .filter(([key]) => {
      const lowerKey = key.toLowerCase();

      return (
        lowerKey.includes('round') ||
        lowerKey.includes('segment') ||
        lowerKey.includes('stage')
      );
    })
    .map(([, value]) => String(value).toLowerCase());

  return values.some((text) => {
    return (
      text === '2' ||
      text.includes('round2') ||
      text.includes('round_2') ||
      text.includes('vong2') ||
      text.includes('vòng 2') ||
      text.includes('ban_ket') ||
      text.includes('bán kết')
    );
  });
}

function formatTarget(target: Target): string {
  if (target.targetType === 'pair') {
    return target.pairLabel;
  }

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
        <h1>Lỗi tải round2_pair_members</h1>
        <pre>{pairMembersError.message}</pre>
      </main>
    );
  }

  const { data: pairs } = await supabase
    .from('round2_pairs')
    .select('*');

  const { data: contestants } = await supabase
    .from('contestants')
    .select('*');

  const { data: scoreSheets, error: scoreSheetsError } = await supabase
    .from('score_sheets')
    .select('*');

  if (scoreSheetsError) {
    return (
      <main style={mainStyle}>
        <h1>Lỗi tải score_sheets</h1>
        <pre>{scoreSheetsError.message}</pre>
      </main>
    );
  }

  const judgeIds = new Set(
    ((round2Judges ?? []) as RoundJudge[]).map((item) => item.judge_id)
  );

  const contestantRows = (contestants ?? []) as AnyRow[];
  const pairRows = (pairs ?? []) as AnyRow[];
  const pairMemberRows = (pairMembers ?? []) as AnyRow[];
  const sheetRows = (scoreSheets ?? []) as AnyRow[];

  const contestantIds = new Set(
    contestantRows
      .map((row) => valueToString(row.id))
      .filter(Boolean)
  );

  const pairIds = new Set(
    pairRows
      .map((row) => valueToString(row.id))
      .filter(Boolean)
  );

  const pairMemberIds = new Set(
    pairMemberRows
      .map((row) => valueToString(row.id))
      .filter(Boolean)
  );

  const contestantsById = new Map<string, AnyRow>();
  for (const contestant of contestantRows) {
    const id = valueToString(contestant.id);
    if (id) contestantsById.set(id, contestant);
  }

  const pairsById = new Map<string, AnyRow>();
  for (const pair of pairRows) {
    const id = valueToString(pair.id);
    if (id) pairsById.set(id, pair);
  }

  const memberIdToContestantId = new Map<string, string>();

  for (const member of pairMemberRows) {
    const memberId = valueToString(member.id);

    const contestantId = findMatchingValue(member, contestantIds, [
      'contestant',
      'candidate',
      'participant',
      'student',
      'player',
    ]);

    if (memberId && contestantId) {
      memberIdToContestantId.set(memberId, contestantId);
    }
  }

  const sortedPairMembers = [...pairMemberRows].sort((a, b) => {
    const pairA =
      findMatchingValue(a, pairIds, ['pair', 'round2']) ??
      '';

    const pairB =
      findMatchingValue(b, pairIds, ['pair', 'round2']) ??
      '';

    if (pairA !== pairB) return pairA.localeCompare(pairB);

    return getMemberOrder(a) - getMemberOrder(b);
  });

  const targetsFromPairMembers: Target[] = sortedPairMembers
    .map((member, index) => {
      const pairId =
        findMatchingValue(member, pairIds, ['pair', 'round2']) ??
        '';

      const contestantId = findMatchingValue(member, contestantIds, [
        'contestant',
        'candidate',
        'participant',
        'student',
        'player',
      ]);

      if (!contestantId) return null;

      const contestant = contestantsById.get(contestantId);
      const pair = pairId ? pairsById.get(pairId) : undefined;

      return {
        targetId: contestantId,
        targetType: 'contestant' as const,
        pairId,
        pairLabel: getPairLabel(pair, index),
        contestantId,
        contestantNumber: normalizeNumber(contestant),
        contestantName: normalizeName(contestant),
      };
    })
    .filter((target): target is Target => Boolean(target));

  function getJudgeIdFromSheet(sheet: AnyRow): string | null {
    return findMatchingValue(sheet, judgeIds, [
      'judge',
      'profile',
      'user',
      'owner',
    ]);
  }

  function getTargetFromSheet(sheet: AnyRow): Target | null {
    const memberId = findMatchingValue(sheet, pairMemberIds, [
      'pair_member',
      'round2_pair_member',
      'member',
    ]);

    if (memberId) {
      const contestantId = memberIdToContestantId.get(memberId);

      if (contestantId) {
        const contestant = contestantsById.get(contestantId);

        return {
          targetId: contestantId,
          targetType: 'contestant',
          pairId: '',
          pairLabel: 'Vòng 2',
          contestantId,
          contestantNumber: normalizeNumber(contestant),
          contestantName: normalizeName(contestant),
        };
      }
    }

    const contestantId = findMatchingValue(sheet, contestantIds, [
      'contestant',
      'candidate',
      'participant',
      'student',
      'player',
      'target',
    ]);

    if (contestantId) {
      const contestant = contestantsById.get(contestantId);

      return {
        targetId: contestantId,
        targetType: 'contestant',
        pairId: '',
        pairLabel: 'Vòng 2',
        contestantId,
        contestantNumber: normalizeNumber(contestant),
        contestantName: normalizeName(contestant),
      };
    }

    const pairId = findMatchingValue(sheet, pairIds, [
      'pair',
      'round2',
      'target',
    ]);

    if (pairId) {
      const pair = pairsById.get(pairId);

      return {
        targetId: pairId,
        targetType: 'pair',
        pairId,
        pairLabel: getPairLabel(pair, 0),
        contestantId: '',
        contestantNumber: '',
        contestantName: '',
      };
    }

    return null;
  }

  const round2Sheets = sheetRows.filter((sheet) => {
    if (rowHasRoundInfo(sheet)) {
      return isRound2Row(sheet);
    }

    return Boolean(getJudgeIdFromSheet(sheet) && getTargetFromSheet(sheet));
  });

  const targetsFromSheetsMap = new Map<string, Target>();

  for (const sheet of round2Sheets) {
    const target = getTargetFromSheet(sheet);
    if (!target) continue;

    if (!targetsFromSheetsMap.has(target.targetId)) {
      targetsFromSheetsMap.set(target.targetId, target);
    }
  }

  const targets =
    targetsFromPairMembers.length > 0
      ? targetsFromPairMembers
      : Array.from(targetsFromSheetsMap.values());

  const targetIdSet = new Set(targets.map((target) => target.targetId));

  const submittedByJudge = new Map<string, Set<string>>();

  for (const sheet of round2Sheets) {
    const judgeId = getJudgeIdFromSheet(sheet);
    const target = getTargetFromSheet(sheet);

    if (!judgeId || !target) continue;
    if (!judgeIds.has(judgeId)) continue;
    if (targetIdSet.size > 0 && !targetIdSet.has(target.targetId)) continue;

    if (!submittedByJudge.has(judgeId)) {
      submittedByJudge.set(judgeId, new Set());
    }

    submittedByJudge.get(judgeId)?.add(target.targetId);
  }

  const rows = ((round2Judges ?? []) as RoundJudge[]).map((item) => {
    const profile = normalizeProfile(item.profiles);
    const submittedTargetIds = submittedByJudge.get(item.judge_id) ?? new Set();

    const submittedTargets = targets.filter((target) =>
      submittedTargetIds.has(target.targetId)
    );

    const missingTargets = targets.filter(
      (target) => !submittedTargetIds.has(target.targetId)
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

  const pairMemberColumns = pairMemberRows[0]
    ? Object.keys(pairMemberRows[0]).join(', ')
    : 'Không có dữ liệu';

  const scoreSheetColumns = sheetRows[0]
    ? Object.keys(sheetRows[0]).join(', ')
    : 'Không có dữ liệu';

  return (
    <main style={mainStyle}>
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Speak Up DNU 2026</p>
        <h1>Tiến độ chấm vòng 2</h1>
        <p>
          Theo dõi chi tiết giám khảo nào còn thiếu điểm của thí sinh/cặp nào trong vòng 2.
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
          <div className="sidebar-label">Số mục cần chấm</div>
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
                  {row.submittedCount}/{targets.length} mục
                </td>
                <td style={tdStyle}>
                  {row.missingCount > 0 ? `${row.missingCount} mục` : '—'}
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
          <div>
            <p>
              Chưa xác định được danh sách mục cần chấm vòng 2. Hệ thống đã đọc được:
            </p>

            <ul>
              <li>
                <strong>round2_pair_members:</strong> {pairMemberRows.length} dòng
              </li>
              <li>
                <strong>round2_pairs:</strong> {pairRows.length} dòng
              </li>
              <li>
                <strong>contestants:</strong> {contestantRows.length} dòng
              </li>
              <li>
                <strong>score_sheets:</strong> {sheetRows.length} dòng
              </li>
            </ul>

            <p>
              Cột trong <code>round2_pair_members</code>: {pairMemberColumns}
            </p>

            <p>
              Cột trong <code>score_sheets</code>: {scoreSheetColumns}
            </p>
          </div>
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
                  <strong>{targets.length}</strong> mục. Còn thiếu{' '}
                  <strong>{row.missingCount}</strong> mục:
                </p>

                <ul style={{ marginBottom: 0 }}>
                  {row.missingTargets.map((target) => (
                    <li key={`${row.judgeId}-${target.targetId}`}>
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
