'use client';

import { useEffect, useState } from 'react';

export function VideoPanel({ contestantId, contestantName, contestantCode }: { contestantId: string; contestantName: string; contestantCode: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/videos/${contestantId}`);
      if (!res.ok) {
        setError('Không tải được video.');
        return;
      }
      const data = await res.json();
      setUrl(data.url);
    }
    load();
  }, [contestantId]);

  return (
    <div className="card-surface sticky-panel video-panel-stage">
      <div className="card-header">
        <div>
          <div className="eyebrow">Khu vực xem video</div>
          <h2 className="card-title">Video dự thi</h2>
          <p className="card-subtitle">{contestantCode} · {contestantName}</p>
        </div>
      </div>

      {error ? <p className="alert alert-danger">{error}</p> : null}
      {url ? (
        <video controls preload="metadata" className="video-frame">
          <source src={url} />
          Trình duyệt không hỗ trợ phát video.
        </video>
      ) : (
        <div className="video-placeholder">Đang tải video...</div>
      )}

      <div className="video-meta-grid">
        <div className="video-meta-box">
          <div className="video-meta-label">SBD</div>
          <div className="video-meta-value">{contestantCode}</div>
        </div>
        <div className="video-meta-box">
          <div className="video-meta-label">Vòng thi</div>
          <div className="video-meta-value">Sơ loại · Xuất chinh</div>
        </div>
      </div>

      <div className="video-help">Giám khảo có thể xem lại video, tạm dừng hoặc tua trước khi chấm điểm từng tiêu chí.</div>
    </div>
  );
}
