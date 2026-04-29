import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';

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
            Xem bảng xếp hạng vòng 1, sắp xếp theo điểm từ cao xuống thấp. Top 30 được đánh dấu màu xanh.
          </p>
        </Link>

        <Link
          href="/admin/round1-score-sheets/print"
          target="_blank"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">PDF</div>
          <h3 className="card-title">Xuất phiếu PDF vòng 1</h3>
          <p className="card-subtitle">
            Mở trang in toàn bộ phiếu chấm vòng 1. Có thể in trực tiếp hoặc lưu thành PDF.
          </p>
        </Link>

        <Link
          href="/admin/round2-score-sheets/print"
          target="_blank"
          className="card-surface"
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: 20,
          }}
        >
          <div className="eyebrow">PDF</div>
          <h3 className="card-title">Xuất phiếu PDF vòng 2</h3>
          <p className="card-subtitle">
            Mở trang in toàn bộ phiếu chấm vòng 2 theo từng thí sinh, đúng tiêu chí chi tiết của vòng Bán kết - Vượt ải.
          </p>
        </Link>

        <div
          className="card-surface"
          style={{
            padding: 20,
            opacity: 0.55,
          }}
        >
          <div className="eyebrow">Vòng 2</div>
          <h3 className="card-title">Tổng hợp điểm vòng 2</h3>
          <p className="card-subtitle">
            Sẽ bổ sung bảng xếp hạng vòng 2 sau khi hoàn thiện chức năng tổng hợp điểm.
          </p>
        </div>

        <div
          className="card-surface"
          style={{
            padding: 20,
            opacity: 0.55,
          }}
        >
          <div className="eyebrow">Vòng 3</div>
          <h3 className="card-title">Tổng hợp điểm vòng 3</h3>
          <p className="card-subtitle">
            Sẽ bổ sung sau khi hoàn thiện luồng chấm trực tiếp vòng chung kết.
          </p>
        </div>
      </section>

      <div style={{ marginTop: 24 }}>
        <Link href="/admin" className="btn btn-secondary">
          Quay lại trang admin
        </Link>
      </div>
    </main>
  );
}
