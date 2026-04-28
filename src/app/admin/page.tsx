import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { StatCard } from '@/components/ui/stat-card';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công vòng 1', description: 'Gán giám khảo chấm thí sinh ở vòng 1.' },
  { href: '/admin/judge-assignments', label: 'Phân công vòng 2-3', description: 'Gán giám khảo chấm vòng 2 và vòng 3.' },
  { href: '/admin/results', label: 'Kết quả', description: 'Tổng hợp điểm, xếp hạng và xuất phiếu chấm điểm.' },
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
      subtitle="Theo dõi tiến độ cuộc thi và đi qua từng bước vận hành theo đúng thứ tự."
      navItems={ADMIN_NAV}
      activeHref="/admin"
      actions={
        <>
          <Link href="/admin/import" className="btn btn-primary">
            Import thí sinh
          </Link>

          <Link href="/admin/assignments" className="btn btn-secondary">
            Phân công vòng 1
          </Link>

          <Link href="/admin/judge-assignments" className="btn btn-secondary">
            Phân công vòng 2-3
          </Link>

          <Link href="/admin/results" className="btn btn-secondary">
            Kết quả
          </Link>

          <Link href="/admin/upload" className="btn btn-secondary">
            Upload video
          </Link>
        </>
      }
    >
      <section className="stats-grid">
        <StatCard
          label="Tổng thí sinh"
          value={contestantCount ?? 0}
          hint="Danh sách thí sinh đã nằm trong hệ thống."
        />

        <StatCard
          label="Số giám khảo"
          value={judgeCount ?? 0}
          hint="Số tài khoản judge hiện đang hoạt động."
        />

        <StatCard
          label="Phiếu đã nộp"
          value={submittedCount ?? 0}
          hint="Tổng số bài đã được giám khảo nộp chính thức."
        />
      </section>
    </DashboardShell>
  );
}
