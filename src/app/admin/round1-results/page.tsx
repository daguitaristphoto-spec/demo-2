import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatScore(value: any) {
  if (value === null || value === undefined) return '-';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '-';
  return numberValue.toFixed(2);
}

export default async function Round1ResultsPage() {
  const { supabase, profile } = await requireRole('admin');

  const { data: sheets, error } = await supabase
    .from('score_sheets')
    .select(`
      id,
      contestant_id,
      judge_id,
      status,
      total_score,
      strengths,
      weaknesses,
      contestant:contestants(id, sbd, full_name),
      judge:profiles(id, full_name, email)
    `)
    .eq('status', 'submitted')
    .or('segment_id.eq.round1_online,segment_id.is.null')
    .order('total_score', { ascending: false });

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <h1>Tổng hợp điểm vòng 1</h1>
        <p style={{ color: 'red' }}>{error.message}</p>
        <Link href="/admin" className="btn btn-secondary">
          Quay lại admin
        </Link>
      </main>
    );
  }

  const rows = sheets ?? [];

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Tổng hợp điểm vòng 1</h1>
          <p>
            Bảng được sắp xếp theo tổng điểm từ cao xuống thấp. Top 30 được đánh dấu màu xanh.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/admin" className="btn btn-secondary">
            Quay lại admin
          </Link>

          <Link href="/admin/round1-score-sheets/print" className="btn btn-primary" target="_blank">
            Xuất phiếu PDF vòng 1
          </Link>
        </div>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Bảng xếp hạng vòng 1</h3>
          <p className="card-subtitle">
            Tổng số phiếu đã nộp: {rows.length}. Màu xanh: Top 30. Màu đỏ: ngoài Top 30.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Giám khảo</th>
                <th>Tổng điểm</th>
                <th>Kết quả</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row: any, index: number) => {
                const contestant = pickRelation(row.contestant);
                const judge = pickRelation(row.judge);
                const isTop30 = index < 30;

                return (
                  <tr
                    key={row.id}
                    style={{
                      background: isTop30 ? 'rgba(22, 163, 74, 0.18)' : 'rgba(220, 38, 38, 0.16)',
                    }}
                  >
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{contestant?.sbd ?? '-'}</td>
                    <td>{contestant?.full_name ?? '-'}</td>
                    <td>{judge?.full_name ?? '-'}</td>
                    <td className="strong-cell">{formatScore(row.total_score)}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontWeight: 700,
                          color: isTop30 ? '#166534' : '#991b1b',
                          background: isTop30 ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)',
                        }}
                      >
                        {isTop30 ? 'Top 30 vào vòng 2' : 'Ngoài Top 30'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    Chưa có phiếu chấm vòng 1 nào được nộp chính thức.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
