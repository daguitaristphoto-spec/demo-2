'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Không lấy được thông tin người dùng.');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    router.push(profile?.role === 'admin' ? '/admin' : '/judge');
    router.refresh();
  }

  return (
    <main className="auth-layout">
      <section className="auth-showcase">
        <div>
          <div className="eyebrow">Speak Up DNU 2026</div>
          <h1 className="auth-title">Own The Mic — hành trình đánh thức chiến mã</h1>
          <p className="auth-description">
            Hệ thống chấm điểm vòng sơ loại được làm mới theo key visual chính thức của cuộc thi, tập trung vào cảm giác sân khấu,
            spotlight và trải nghiệm thao tác rõ ràng cho admin lẫn giám khảo.
          </p>
          <div className="brand-script">Nền xanh sân khấu, ánh vàng spotlight, tinh thần chiến mã và điểm nhấn micro trung tâm.</div>
        </div>

        <div className="hero-stat-row">
          <div className="hero-stat">
            <div className="hero-stat-value">100</div>
            <div className="hero-stat-label">Thí sinh vòng sơ loại</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">05</div>
            <div className="hero-stat-label">Giám khảo chuyên môn</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">01</div>
            <div className="hero-stat-label">Tài khoản admin điều phối</div>
          </div>
        </div>

        <div className="feature-stack">
          <div className="feature-card">
            <strong>Chấm trong một màn hình</strong>
            <span>Giám khảo xem video, nhập điểm, ghi nhận xét và nộp phiếu ngay tại một nơi.</span>
          </div>
          <div className="feature-card">
            <strong>Quản trị theo đúng quy trình</strong>
            <span>Import Excel, phân công 1 giám khảo cho 1 thí sinh, upload video và theo dõi tiến độ.</span>
          </div>
          <div className="feature-card">
            <strong>Khóa phiếu sau khi nộp</strong>
            <span>Giữ tính kỷ luật của cuộc thi: chỉ admin mới có thể mở lại để chỉnh sửa.</span>
          </div>
        </div>

        <div className="brand-mark-row">
          <div className="brand-mark">Dark blue + gold spotlight</div>
          <div className="brand-mark">Glass card sang trọng</div>
          <div className="brand-mark">Key visual Speak Up DNU 2026</div>
        </div>
      </section>

      <section className="auth-panel">
        <form onSubmit={handleSubmit} className="auth-form card-surface">
          <div>
            <div className="eyebrow">Đăng nhập hệ thống</div>
            <h2 className="auth-form-title">Chào mừng trở lại</h2>
            <p className="auth-form-subtitle">Sử dụng email và mật khẩu của bạn để vào khu vực quản trị hoặc khu vực chấm điểm.</p>
          </div>

          <div className="field-group">
            <label className="field-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="admin@speakup.local"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? <p className="alert alert-danger">{error}</p> : null}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
}
