'use client';

import { useEffect, useMemo, useState } from 'react';

type ScoreItem = {
  id: string;
  key: string;
  label: string;
  score: number | null;
  maxScore: number | null;
  note: string;
};

type ScoreSheet = {
  id: string;
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  status: string;
  totalScore: number | null;
  strengths: string;
  weaknesses: string;
  generalComment: string;
  submittedAt: string;
  items: ScoreItem[];
};

type Contestant = {
  id: string;
  code: string;
  name: string;
  unit: string;
  videoUrl: string;
  sheets: ScoreSheet[];
};

const criterionLabels: Record<string, string> = {
  content: 'Nội dung',
  voice: 'Giọng nói',
  pronunciation: 'Phát âm',
  style: 'Phong thái',
  confidence: 'Sự tự tin',
  creativity: 'Sáng tạo',
  interaction: 'Tương tác',
  overall: 'Đánh giá tổng thể',
};

function toGoogleDrivePreviewUrl(url: string) {
  if (!url) return '';

  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }

  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }

  return url;
}

function formatStatus(status: string) {
  if (status === 'submitted') return 'Đã nộp';
  if (status === 'draft') return 'Bản nháp';
  if (status === 'not_started') return 'Chưa chấm';
  return status || 'Chưa rõ';
}

function formatDate(value: string) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN');
}

export default function AdminRound1ScoreReviewPage() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [selectedContestantId, setSelectedContestantId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/round1-score-review', {
        cache: 'no-store',
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Không tải được dữ liệu');
      }

      setContestants(payload.contestants ?? []);

      if (!selectedContestantId && payload.contestants?.length) {
        setSelectedContestantId(payload.contestants[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredContestants = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return contestants;

    return contestants.filter((contestant) => {
      return [
        contestant.code,
        contestant.name,
        contestant.unit,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [contestants, keyword]);

  const selectedContestant = useMemo(() => {
    return (
      contestants.find((contestant) => contestant.id === selectedContestantId) ??
      filteredContestants[0] ??
      null
    );
  }, [contestants, filteredContestants, selectedContestantId]);

  const videoPreviewUrl = selectedContestant
    ? toGoogleDrivePreviewUrl(selectedContestant.videoUrl)
    : '';

  const submittedSheets =
    selectedContestant?.sheets.filter((sheet) => sheet.status === 'submitted')
      .length ?? 0;

  const averageScore = useMemo(() => {
    if (!selectedContestant) return null;

    const validScores = selectedContestant.sheets
      .map((sheet) => sheet.totalScore)
      .filter((score): score is number => typeof score === 'number');

    if (!validScores.length) return null;

    return (
      validScores.reduce((total, score) => total + score, 0) / validScores.length
    );
  }, [selectedContestant]);

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow">Admin</p>
        <h1>Xem chi tiết chấm điểm vòng 1</h1>
        <p>
          Theo dõi video dự thi và toàn bộ phiếu chấm của giám khảo cho từng thí sinh.
        </p>
      </div>

      {error ? (
        <div
          style={{
            padding: 16,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <aside
          className="card-surface"
          style={{
            padding: 16,
            position: 'sticky',
            top: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm SBD, tên, đơn vị..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(255,255,255,0.06)',
                color: 'inherit',
              }}
            />

            <button
              type="button"
              onClick={loadData}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Tải lại
            </button>
          </div>

          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredContestants.map((contestant) => {
                const active = contestant.id === selectedContestant?.id;

                return (
                  <button
                    key={contestant.id}
                    type="button"
                    onClick={() => setSelectedContestantId(contestant.id)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 12,
                      border: active
                        ? '1px solid rgba(247, 213, 140, 0.8)'
                        : '1px solid rgba(255,255,255,0.12)',
                      background: active
                        ? 'rgba(247, 213, 140, 0.12)'
                        : 'rgba(255,255,255,0.04)',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>
                      {contestant.code ? `${contestant.code} - ` : ''}
                      {contestant.name || 'Chưa có tên'}
                    </strong>
                    <div style={{ fontSize: 13, opacity: 0.76 }}>
                      {contestant.unit || 'Chưa có đơn vị'} ·{' '}
                      {contestant.sheets.length} phiếu chấm
                    </div>
                  </button>
                );
              })}

              {!filteredContestants.length ? (
                <p>Chưa có thí sinh phù hợp.</p>
              ) : null}
            </div>
          )}
        </aside>

        <section>
          {!selectedContestant ? (
            <div className="card-surface" style={{ padding: 20 }}>
              Chưa có dữ liệu thí sinh.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card-surface" style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p className="eyebrow">Thí sinh vòng 1</p>
                    <h2 style={{ marginTop: 0 }}>
                      {selectedContestant.code
                        ? `${selectedContestant.code} - `
                        : ''}
                      {selectedContestant.name || 'Chưa có tên'}
                    </h2>
                    <p>{selectedContestant.unit || 'Chưa có đơn vị'}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div>
                      <strong>{selectedContestant.sheets.length}</strong> phiếu chấm
                    </div>
                    <div>
                      <strong>{submittedSheets}</strong> phiếu đã nộp
                    </div>
                    <div>
                      Điểm trung bình:{' '}
                      <strong>
                        {averageScore === null
                          ? 'Chưa có'
                          : averageScore.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-surface" style={{ padding: 20 }}>
                <h3 style={{ marginTop: 0 }}>Video dự thi</h3>

                {videoPreviewUrl ? (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '56.25%',
                      borderRadius: 16,
                      overflow: 'hidden',
                      background: 'rgba(0,0,0,0.28)',
                    }}
                  >
                    <iframe
                      src={videoPreviewUrl}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      title={`Video dự thi ${selectedContestant.name}`}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        border: 0,
                      }}
                    />
                  </div>
                ) : (
                  <p>Thí sinh này chưa có link video.</p>
                )}

                {selectedContestant.videoUrl ? (
                  <p style={{ marginTop: 12 }}>
                    <a
                      href={selectedContestant.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở video gốc
                    </a>
                  </p>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <h3>Phiếu chấm của giám khảo</h3>

                {selectedContestant.sheets.length ? (
                  selectedContestant.sheets.map((sheet) => (
                    <article
                      key={sheet.id}
                      className="card-surface"
                      style={{ padding: 20 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          flexWrap: 'wrap',
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <h4 style={{ margin: 0 }}>{sheet.judgeName}</h4>
                          {sheet.judgeEmail ? (
                            <p style={{ margin: '4px 0 0', opacity: 0.75 }}>
                              {sheet.judgeEmail}
                            </p>
                          ) : null}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div>
                            Trạng thái:{' '}
                            <strong>{formatStatus(sheet.status)}</strong>
                          </div>
                          <div>
                            Tổng điểm:{' '}
                            <strong>
                              {sheet.totalScore === null
                                ? 'Chưa có'
                                : sheet.totalScore}
                            </strong>
                          </div>
                          {sheet.submittedAt ? (
                            <div style={{ fontSize: 13, opacity: 0.75 }}>
                              {formatDate(sheet.submittedAt)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {sheet.items.length ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              marginBottom: 16,
                            }}
                          >
                            <thead>
                              <tr>
                                <th style={thStyle}>Tiêu chí</th>
                                <th style={thStyle}>Điểm</th>
                                <th style={thStyle}>Tối đa</th>
                                <th style={thStyle}>Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.items.map((item) => (
                                <tr key={item.id}>
                                  <td style={tdStyle}>
                                    {item.label ||
                                      criterionLabels[item.key] ||
                                      item.key ||
                                      'Tiêu chí'}
                                  </td>
                                  <td style={tdStyle}>
                                    {item.score === null ? '' : item.score}
                                  </td>
                                  <td style={tdStyle}>
                                    {item.maxScore === null ? '' : item.maxScore}
                                  </td>
                                  <td style={tdStyle}>{item.note}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>Phiếu này chưa có điểm tiêu chí.</p>
                      )}

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: 12,
                        }}
                      >
                        <div>
                          <strong>Điểm mạnh</strong>
                          <p>{sheet.strengths || 'Chưa có nhận xét'}</p>
                        </div>

                        <div>
                          <strong>Điểm cần cải thiện</strong>
                          <p>{sheet.weaknesses || 'Chưa có nhận xét'}</p>
                        </div>

                        {sheet.generalComment ? (
                          <div>
                            <strong>Nhận xét chung</strong>
                            <p>{sheet.generalComment}</p>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="card-surface" style={{ padding: 20 }}>
                    Chưa có phiếu chấm nào cho thí sinh này.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.14)',
  fontSize: 13,
  opacity: 0.78,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  verticalAlign: 'top',
};
