'use client';

import { useEffect, useState } from 'react';

type VideoResponse = {
  url?: string;
  originalUrl?: string;
  kind?: 'google_drive' | 'direct_url' | 'storage';
  error?: string;
};

export function VideoPanel({
  contestantId,
  contestantName,
  contestantCode,
}: {
  contestantId: string;
  contestantName: string;
  contestantCode: string;
}) {
  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      setVideo(null);

      const res = await fetch(`/api/videos/${contestantId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Không tải được video.');
        return;
      }

      setVideo(data);
    }

    load();
  }, [contestantId]);

  return (
    <div className="card-surface sticky-panel video-panel-stage">
      <div className="card-header">
        <div>
          <div className="eyebrow">Khu vực xem video</div>
          <h2 className="card-title">Video dự thi</h2>
          <p className="card-subtitle">
            {contestantCode} · {contestantName}
          </p>
        </div>
      </div>

      {error ? <p className="alert alert-danger">{error}</p> : null}

      {video?.url ? (
        video.kind === 'google_drive' ? (
          <iframe
            src={video.url}
            className="video-frame"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={`Video dự thi ${contestantCode}`}
            style={{
              width: '100%',
              minHeight: 420,
              border: 0,
              borderRadius: 16,
              background: '#000',
            }}
          />
        ) : (
          <video controls preload="metadata" className="video-frame">
            <source src={video.url} />
            Trình duyệt không hỗ trợ phát video.
          </video>
        )
      ) : !error ? (
        <div className="video-placeholder">Đang tải video...</div>
      ) : null}

      {video?.kind === 'google_drive' ? (
        <div className="video-help" style={{ marginTop: 12 }}>
          Nếu video không hiển thị, hãy kiểm tra quyền chia sẻ Google Drive: video cần để chế độ
          <strong> Anyone with the link can view</strong>.
        </div>
      ) : null}

      {video?.originalUrl ? (
        <div className="video-help" style={{ marginTop: 12 }}>
          <a href={video.originalUrl} target="_blank" rel="noreferrer">
            Mở video trong tab mới
          </a>
        </div>
      ) : null}

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

      <div className="video-help">
        Giám khảo có thể xem lại video, tạm dừng hoặc tua trước khi chấm điểm từng tiêu chí.
      </div>
    </div>
  );
}
