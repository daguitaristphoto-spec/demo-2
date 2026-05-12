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
          Quản lý tổng hợp điểm, xếp hạng thí sinh và xuất phiếu chấm điểm theo từng vòng.
        </p>
      </div>

      <RoundCompletionStatus />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        <Link
          href="/admin/round1-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            padding: 20,
          }}
        >
          <p className="eyebrow">Vòng 1</p>
          <h2>Kết quả vòng 1</h2>
          <p>
            Xem tổng hợp điểm, xếp hạng thí sinh và xuất phiếu điểm vòng 1.
          </p>
        </Link>

        <Link
          href="/admin/round2-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            padding: 20,
          }}
        >
          <p className="eyebrow">Vòng 2</p>
          <h2>Kết quả vòng 2</h2>
          <p>
            Xem tổng hợp điểm, xếp hạng cặp thi và xuất phiếu điểm vòng 2.
          </p>
        </Link>

        <Link
          href="/admin/round2-judge-status"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            padding: 20,
          }}
        >
          <p className="eyebrow">Vòng 2</p>
          <h2>Tiến độ chấm vòng 2</h2>
          <p>
            Xem giám khảo nào đã chấm đủ và giám khảo nào chưa nộp điểm vòng 2.
          </p>
        </Link>

        <Link
          href="/admin/round3-results"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            padding: 20,
          }}
        >
          <p className="eyebrow">Vòng 3</p>
          <h2>Kết quả vòng 3</h2>
          <p>
            Xem tổng hợp điểm, xếp hạng thí sinh và xuất phiếu điểm vòng 3.
          </p>
        </Link>
      </section>
    </main>
  );
}
