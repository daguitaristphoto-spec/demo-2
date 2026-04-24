import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Speak Up Đại Nam 2026',
  description: 'Hệ thống chấm điểm vòng sơ loại',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
