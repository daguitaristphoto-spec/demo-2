import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { StatCard } from '@/components/ui/stat-card';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công giám khảo', description: 'Gán đúng 1 giám khảo cho mỗi thí sinh.' },
  { href: '/admin/upload', label: 'Upload video', description: 'Lưu video dự thi để giám khảo xem trực tiếp.' },
];

export default async function AdminDashboardPage() {
  const { supabase, profile } = await requireRole('admin');

  const [{ count: contestantCount }, { count: judgeCount }, { count: submittedCount }] = await Promise.all([
    supabase.from('contestants').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'judge'),
    supabase.from('score_sheets').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
  ]);

  return (
    <DashboardShell
      roleLabel="Admin"
      userName={profile.full_name}
      title={`Xin chào, ${profile.full_name}`}
      subtitle="Theo dõi tiến độ vòng sơ loại và đi qua từng bước vận hành theo đúng thứ tự."
      navItems={ADMIN_NAV}
      activeHref="/admin"
      actions={
        <>
          <Link href="/admin/import" className="btn btn-primary">Import thí sinh</Link>
          <Link href="/admin/assignments" className="btn btn-secondary">Phân công</Link>
          <Link href="/admin/upload" className="btn btn-secondary">Upload video</Link>
        </>
      }
    >
      <section className="stats-grid">
        <StatCard label="Tổng thí sinh" value={contestantCount ?? 0} hint="Danh sách thí sinh đã nằm trong hệ thống." />
        <StatCard label="Số giám khảo" value={judgeCount ?? 0} hint="Số tài khoản judge hiện đang hoạt động." />
        <StatCard label="Phiếu đã nộp" value={submittedCount ?? 0} hint="Tổng số bài đã được giám khảo nộp chính thức." />
      </section>

      <section className="content-grid-two">
        <div className="card-surface card-gradient">
          <div className="card-header">
            <h3 className="card-title">Luồng làm việc khuyến nghị</h3>
            <p className="card-subtitle">Một quy trình ngắn gọn để vận hành vòng sơ loại mượt hơn.</p>
          </div>
          <div className="timeline-list">
            <div className="timeline-item"><strong>1.</strong> Tạo tài khoản judge trong Supabase Auth và gán role trong bảng profiles.</div>
            <div className="timeline-item"><strong>2.</strong> Import 100 thí sinh từ Excel.</div>
            <div className="timeline-item"><strong>3.</strong> Phân công 20 thí sinh cho mỗi giám khảo.</div>
            <div className="timeline-item"><strong>4.</strong> Upload video cho từng thí sinh và kiểm tra phát lại.</div>
            <div className="timeline-item"><strong>5.</strong> Theo dõi số phiếu đã nộp và mở lại nếu cần chấm sửa.</div>
          </div>
        </div>

        <div className="card-surface">
          <div className="card-header">
            <h3 className="card-title">Mục tiêu của phiên bản hiện tại</h3>
            <p className="card-subtitle">Tập trung vào vòng 1 trước khi mở rộng thêm các vòng còn lại.</p>
          </div>
          <div className="bullet-stack">
            <div className="bullet-item">Giao diện admin rõ ràng hơn để theo dõi tiến độ.</div>
            <div className="bullet-item">Màn hình giám khảo tập trung vào xem video và chấm điểm.</div>
            <div className="bullet-item">Các hành động chính được gom thành các nút nổi bật ở đầu trang.</div>
            <div className="bullet-item">Giữ logic phân quyền cũ, chỉ nâng cấp trải nghiệm sử dụng.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
