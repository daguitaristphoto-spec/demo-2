import { requireRole } from '@/lib/auth-guard';
import { UploadManager } from '@/components/admin/upload-manager';
import { DashboardShell } from '@/components/ui/dashboard-shell';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan', description: 'Theo dõi tiến độ và các bước vận hành.' },
  { href: '/admin/import', label: 'Import thí sinh', description: 'Đưa danh sách từ Excel vào hệ thống.' },
  { href: '/admin/assignments', label: 'Phân công giám khảo', description: 'Gán đúng 1 giám khảo cho mỗi thí sinh.' },
  { href: '/admin/upload', label: 'Upload video', description: 'Lưu video dự thi để giám khảo xem trực tiếp.' },
];

export default async function UploadVideosPage() {
  const { profile } = await requireRole('admin');

  return (
    <DashboardShell
      roleLabel="Admin"
      userName={profile.full_name}
      title="Upload video thí sinh"
      subtitle="Tải video dự thi lên hệ thống để giám khảo có thể xem trực tiếp trên màn hình chấm điểm."
      navItems={ADMIN_NAV}
      activeHref="/admin/upload"
    >
      <UploadManager />
    </DashboardShell>
  );
}
