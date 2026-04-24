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
          <div className="hero-highlight-top">Quy trình gợi ý</div>
          <div className="timeline-list">
            <div className="timeline-item"><strong>1.</strong> Import danh sách thí sinh từ Excel vào hệ thống.</div>
            <div className="timeline-item"><strong>2.</strong> Gán đúng 1 giám khảo cho từng thí sinh ở vòng sơ loại.</div>
            <div className="timeline-item"><strong>3.</strong> Upload video dự thi để giám khảo xem trực tiếp trên web.</div>
            <div className="timeline-item"><strong>4.</strong> Giám khảo nộp phiếu, admin theo dõi tiến độ và mở lại nếu cần.</div>
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
