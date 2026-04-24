import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">Speak Up DNU 2026</div>
          <h1 className="hero-title">Hệ thống chấm điểm vòng sơ loại mang đúng tinh thần sân khấu của cuộc thi</h1>
          <div className="hero-kicker">Own The Mic — Hành trình đánh thức chiến mã</div>
          
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">Đăng nhập hệ thống</Link>
      

          <div className="hero-stat-row">
            <div className="hero-stat">
              <div className="hero-stat-value">100</div>
              <div className="hero-stat-label">Thí sinh</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">05</div>
              <div className="hero-stat-label">Giám khảo</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">30</div>
              <div className="hero-stat-label">Tối đa vào bán kết</div>
            </div>
          </div>
        </div>

        <div className="hero-highlight card-gradient">
          
          </div>

          <div className="poster-card">
            <img src="/speakup-keyvisual.jpg" alt="Speak Up DNU 2026 key visual" />
            <div className="poster-caption">
              Key visual được tích hợp vào login, dashboard và khu vực chấm điểm theo hướng sang trọng, rõ ràng và dễ thao tác.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
