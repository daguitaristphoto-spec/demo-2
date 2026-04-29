import { requireRole } from '@/lib/auth-guard';
import { AssignmentManager } from '@/components/admin/assignment-manager';
import { DashboardShell } from '@/components/ui/dashboard-shell';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công vòng 1', description: 'Gán giám khảo chấm thí sinh ở vòng 1.' },
  { href: '/admin/round2-pairs', label: 'Gán cặp vòng 2', description: 'Ghép 30 thí sinh điểm cao nhất thành từng cặp.' },
  { href: '/admin/judge-assignments', label: 'Phân công vòng 2-3', description: 'Gán giám khảo chấm vòng 2 và vòng 3.' },
  { href: '/admin/results', label: 'Kết quả', description: 'Tổng hợp điểm, xếp hạng và xuất phiếu chấm điểm.' },
];

export default async function AssignmentsPage() {
  const { profile } = await requireRole('admin');

  return (
    <DashboardShell
      roleLabel="Admin"
      userName={profile.full_name}
      title="Phân công giám khảo vòng 1"
      subtitle="Mỗi thí sinh chỉ được gán cho đúng 1 giám khảo. Admin có thể mở lại phiếu đã nộp khi cần chấm sửa."
      navItems={ADMIN_NAV}
      activeHref="/admin/assignments"
    >
      <AssignmentManager />
    </DashboardShell>
  );
}
