import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

const JUDGE_NAV = [
  {
    href: '/judge',
    label: 'Chấm vòng 1',
    description: 'Xem toàn bộ thí sinh bạn được phân công ở vòng sơ loại.',
  },
  {
    href: '/judge/round2',
    label: 'Chấm vòng 2',
    description: 'Chấm cặp thí sinh ở vòng bán kết.',
  },
  {
    href: '/judge/round3',
    label: 'Chấm vòng 3',
    description: 'Chấm liên thông các chặng chung kết.',
  },
  {
    href: '/judge/tie-breaks',
    label: 'Vote đồng điểm',
    description: 'Vote chọn thí sinh đi tiếp khi có đồng điểm ở ngưỡng loại.',
  },
];

export default async function JudgeDashboardPage() {
  const { supabase, user, profile } = await requireRole('judge');

  const [{ data: assignments }, { data: sheets }] = await Promise.all([
    supabase
      .from('assignments')
      .select('contestant_id, can_edit, contestant:contestants(id, sbd, full_name, video_path)')
      .eq('judge_id', user.id)
      .order('created_at'),

    supabase
      .from('score_sheets')
      .select('contestant_id, status, total_score, segment_id')
      .eq('judge_id', user.id)
      .or('segment_id.eq.round1_online,segment_id.is.null'),
  ]);

  const sheetMap = new Map((sheets ?? []).map((sheet) => [sheet.contestant_id, sheet]));

  const submittedRound1Count = (assignments ?? []).filter((row: any) => {
    const sheet = sheetMap.get(row.contestant_id);
    return sheet?.status === 'submitted';
  }).length;

  const assignedCount = assignments?.length ?? 0;
  const remainingCount = assignedCount - submittedRound1Count;

  return (
    <DashboardShell
      roleLabel="Giám khảo"
      userName={profile.full_name}
      title={`Xin chào, ${profile.full_name}`}
      subtitle="Đây là trang chủ của giám khảo. Bạn có thể chấm vòng 1 theo danh sách được phân công, hoặc vào khu vực chấm vòng 2, vòng 3 và vote đồng điểm khi có yêu cầu."
      navItems={JUDGE_NAV}
      activeHref="/judge"
    >
      <section className="card-surface">
        <div className="card-header">
          <h3 className="card-title">Khu vực chấm điểm</h3>
          <p className="card-subtitle">
            Vòng 1 sử dụng danh sách thí sinh được phân công. Vòng 2 và vòng 3 sử dụng giao diện chấm riêng.
            Khi có thí sinh đồng điểm ở ngưỡng vào vòng tiếp theo, giám khảo vào mục Vote đồng điểm để bình chọn.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/judge" className="btn btn-primary">
            Chấm vòng 1
          </Link>

          <Link href="/judge/round2" className="btn btn-secondary">
            Chấm vòng 2
          </Link>

          <Link href="/judge/round3" className="btn btn-secondary">
            Chấm vòng 3
          </Link>

          <Link href="/judge/tie-breaks" className="btn btn-secondary">
            Vote đồng điểm
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Được phân công vòng 1"
          value={assignedCount}
          hint="Tổng số thí sinh bạn cần chấm ở vòng sơ loại."
        />

        <StatCard
          label="Đã nộp phiếu vòng 1"
          value={submittedRound1Count}
          hint="Số phiếu vòng 1 đã nộp chính thức."
        />

        <StatCard
          label="Còn lại vòng 1"
          value={remainingCount}
          hint="Số bài vòng 1 vẫn cần hoàn thành."
        />
      </section>

      <section className="card-surface">
        <div className="card-header">
          <h3 className="card-title">Danh sách thí sinh được giao ở vòng 1</h3>
          <p className="card-subtitle">
            Mở từng bài để xem video, nhập điểm và nộp phiếu chính thức.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Video</th>
                <th>Trạng thái</th>
                <th>Tổng điểm</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {(assignments ?? []).map((row: any) => {
                const contestant = Array.isArray(row.contestant)
                  ? row.contestant[0]
                  : row.contestant;

                const sheet = sheetMap.get(row.contestant_id);

                const status =
                  sheet?.status === 'submitted'
                    ? row.can_edit
                      ? { label: 'Đã nộp - đang mở lại', tone: 'warning' as const }
                      : { label: 'Đã nộp', tone: 'success' as const }
                    : { label: 'Chưa nộp', tone: 'neutral' as const };

                return (
                  <tr key={contestant?.id}>
                    <td className="strong-cell">{contestant?.sbd}</td>

                    <td>{contestant?.full_name}</td>

                    <td>
                      <StatusBadge tone={contestant?.video_path ? 'info' : 'danger'}>
                        {contestant?.video_path ? 'Có video' : 'Chưa có video'}
                      </StatusBadge>
                    </td>

                    <td>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </td>

                    <td>{sheet?.total_score ?? '-'}</td>

                    <td className="table-action-cell">
                      <Link
                        href={`/judge/contestants/${contestant?.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Vào chấm
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {(assignments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    Bạn chưa được phân công thí sinh nào ở vòng 1.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
