import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">Speak Up DNU 2026</div>
          <h1 className="hero-title">Hệ thống chấm điểm trực tuyến</h1>
          <div className="hero-kicker">Own The Mic — Hành trình đánh thức chiến mã</div>
          
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">Đăng nhập hệ thống</Link>
     
          <div className="poster-card">
            <img src="/speakup-keyvisual.jpg" alt="Speak Up DNU 2026 key visual" />
            
          </div>
        </div>
      </section>
    </main>
  );
}
