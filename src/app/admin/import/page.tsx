import { requireRole } from '@/lib/auth-guard';
import { ImportContestantsManager } from '@/components/admin/import-contestants-manager';
import { DashboardShell } from '@/components/ui/dashboard-shell';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công giám khảo', description: 'Gán đúng 1 giám khảo cho mỗi thí sinh.' },
  { href: '/admin/round2-pairs', label: 'Gán cặp vòng 2', description: 'Ghép 30 thí sinh điểm cao nhất thành từng cặp.' },
  { href: '/admin/judge-assignments', label: 'Phân công vòng 2-3', description: 'Gán giám khảo chấm vòng 2 và vòng 3.' },
  { href: '/admin/results', label: 'Kết quả', description: 'Tổng hợp điểm, xếp hạng và xuất phiếu chấm điểm.' },
];

export default async function ImportContestantsPage() {
  const { profile } = await requireRole('admin');

  return (
    <DashboardShell
      roleLabel="Admin"
      userName={profile.full_name}
      title="Import thí sinh từ Excel"
      subtitle="File import gồm 3 cột: Số báo danh, Họ và tên, Link video Google Drive."
      navItems={ADMIN_NAV}
      activeHref="/admin/import"
    >
      <ImportContestantsManager />
    </DashboardShell>
  );
}
