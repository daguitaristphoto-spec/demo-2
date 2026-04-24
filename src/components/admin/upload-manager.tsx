'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { StatusBadge } from '@/components/ui/status-badge';

type Contestant = {
  id: string;
  sbd: string;
  full_name: string;
  video_path: string | null;
};

export function UploadManager() {
  const supabase = createClient();
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [selectedContestantId, setSelectedContestantId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('contestants').select('id, sbd, full_name, video_path').order('sbd');
      setContestants((data ?? []) as Contestant[]);
    }
    load();
  }, []);

  async function handleUpload() {
    if (!selectedContestantId || !file) {
      setMessage('Hãy chọn thí sinh và file video.');
      return;
    }

    setUploading(true);
    setMessage(null);

    const signRes = await fetch('/api/admin/videos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestantId: selectedContestantId, filename: file.name }),
    });

    if (!signRes.ok) {
      setMessage('Không tạo được URL upload.');
      setUploading(false);
      return;
    }

    const { path, token } = await signRes.json();
    const bucket = process.env.NEXT_PUBLIC_VIDEO_BUCKET || 'contestant-videos';

    const uploadRes = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
    if (uploadRes.error) {
      setMessage(uploadRes.error.message);
      setUploading(false);
      return;
    }

    const attachRes = await fetch('/api/admin/videos/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestantId: selectedContestantId, path }),
    });

    if (!attachRes.ok) {
      setMessage('Upload xong nhưng chưa lưu được đường dẫn video.');
      setUploading(false);
      return;
    }

    setMessage('Upload video thành công.');
    setFile(null);
    setUploading(false);

    const { data } = await supabase.from('contestants').select('id, sbd, full_name, video_path').order('sbd');
    setContestants((data ?? []) as Contestant[]);
  }

  const selectedContestant = useMemo(
    () => contestants.find((contestant) => contestant.id === selectedContestantId),
    [contestants, selectedContestantId]
  );

  return (
    <section className="content-grid-two">
      <div className="card-surface">
        <div className="card-header">
          <h3 className="card-title">Chọn thí sinh và video</h3>
          <p className="card-subtitle">Video sau khi upload sẽ hiển thị trực tiếp trên giao diện chấm điểm của giám khảo.</p>
        </div>

        <div className="field-group">
          <label className="field-label">Thí sinh</label>
          <select value={selectedContestantId} onChange={(e) => setSelectedContestantId(e.target.value)} className="select">
            <option value="">-- Chọn thí sinh --</option>
            {contestants.map((contestant) => (
              <option key={contestant.id} value={contestant.id}>
                {contestant.sbd} - {contestant.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">File video</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
            className="input file-input"
          />
        </div>

        <button onClick={handleUpload} disabled={uploading} className="btn btn-primary">
          {uploading ? 'Đang upload...' : 'Upload video'}
        </button>

        {message ? <div className="alert alert-info">{message}</div> : null}
      </div>

      <div className="card-surface card-gradient">
        <div className="card-header">
          <h3 className="card-title">Thông tin nhanh</h3>
          <p className="card-subtitle">Kiểm tra lại thí sinh đã chọn trước khi upload để tránh nhầm video.</p>
        </div>

        {selectedContestant ? (
          <div className="bullet-stack">
            <div className="bullet-item"><strong>SBD:</strong> {selectedContestant.sbd}</div>
            <div className="bullet-item"><strong>Họ và tên:</strong> {selectedContestant.full_name}</div>
            <div className="bullet-item">
              <strong>Trạng thái video:</strong>{' '}
              <StatusBadge tone={selectedContestant.video_path ? 'success' : 'warning'}>
                {selectedContestant.video_path ? 'Đã có video cũ' : 'Chưa có video'}
              </StatusBadge>
            </div>
            {file ? <div className="bullet-item"><strong>File đang chọn:</strong> {file.name}</div> : null}
          </div>
        ) : (
          <div className="empty-panel">Hãy chọn một thí sinh để xem thông tin nhanh trước khi upload.</div>
        )}
      </div>
    </section>
  );
}
