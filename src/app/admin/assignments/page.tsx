import { requireRole } from '@/lib/auth-guard';
import { AssignmentManager } from '@/components/admin/assignment-manager';
import { DashboardShell } from '@/components/ui/dashboard-shell';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công giám khảo', description: 'Gán đúng 1 giám khảo cho mỗi thí sinh.' },
  { href: '/admin/upload', label: 'Upload video', description: 'Lưu video dự thi để giám khảo xem trực tiếp.' },
];

export default async function AssignmentsPage() {
  const { profile } = await requireRole('admin');

  return (
    <DashboardShell
      roleLabel="Admin"
      userName={profile.full_name}
      title="Phân công giám khảo"
      subtitle="Mỗi thí sinh chỉ được gán cho đúng 1 giám khảo. Admin có thể mở lại phiếu đã nộp khi cần chấm sửa."
      navItems={ADMIN_NAV}
      activeHref="/admin/assignments"
    >
      <AssignmentManager />
    </DashboardShell>
  );
}
