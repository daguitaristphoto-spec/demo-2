import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { StatCard } from '@/components/ui/stat-card';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công giám khảo', description: 'Gán đúng 1 giám khảo cho mỗi thí sinh.' },
  { href: '/admin/judge-assignments', label: 'Phân công GK theo vòng', description: 'Gán giám khảo cho từng vòng/chặng thi.' },
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
    </DashboardShell>
  );
}
