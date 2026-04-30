import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { RoundCompletionStatus } from '@/components/admin/round-completion-status';

export default async function AdminResultsPage() {
  await requireRole('admin');

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Speak Up DNU 2026</p>
        <h1>Kết quả cuộc thi</h1>
        <p>
          Quản lý tổng hợp điểm, xếp hạng thí sinh và xuất phiếu chấm điểm trong từng trang tổng hợp.
        </p>
      </div>

      <RoundCompletionStatus />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <Link
          href="/admin/round1-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">Vòng 1</div>
          <h3 className="card-title">Tổng hợp điểm vòng 1</h3>
          <p className="card-subtitle">
            Xem bảng xếp hạng vòng 1, sắp xếp theo điểm từ cao xuống thấp.
            Top 30 được đánh dấu màu xanh.
          </p>
        </Link>

        <Link
          href="/admin/round2-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">Vòng 2</div>
          <h3 className="card-title">Tổng hợp điểm vòng 2</h3>
          <p className="card-subtitle">
            Xem bảng xếp hạng vòng 2 và điểm trung bình của từng thí sinh theo số phiếu giám khảo đã nộp.
          </p>
        </Link>

        <Link
          href="/admin/round3-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">Vòng 3</div>
          <h3 className="card-title">Tổng hợp điểm vòng 3</h3>
          <p className="card-subtitle">
            Xem danh sách thí sinh vào vòng 3, điểm trung bình từng chặng,
            lấy Top 3 sau chặng 1 + 2 và xếp hạng chung cuộc sau chặng 3.
          </p>
        </Link>

        <Link
          href="/admin/tie-breaks"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">Vote</div>
          <h3 className="card-title">Quản lý vote đồng điểm</h3>
          <p className="card-subtitle">
            Theo dõi và chốt kết quả vote khi có thí sinh đồng điểm ở ngưỡng vào vòng tiếp theo.
          </p>
        </Link>
      </section>

      <div style={{ marginTop: 24 }}>
        <Link href="/admin" className="btn btn-secondary">
          Quay lại trang admin
        </Link>
      </div>
    </main>
  );
}
