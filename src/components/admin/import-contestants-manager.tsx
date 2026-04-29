'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { mapExcelRowsToContestants, type ContestantImportRow } from '@/lib/import-contestants';

type ImportResult = {
  inserted: number;
  updated: number;
  total: number;
};

export function ImportContestantsManager() {
  const [rows, setRows] = useState<ContestantImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setResult(null);
    setMessage(null);

    if (!file) {
      setFilename(null);
      setRows([]);
      setErrors([]);
      return;
    }

    setFilename(file.name);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        setRows([]);
        setErrors(['File Excel không có sheet dữ liệu.']);
        return;
      }

      const sheet = workbook.Sheets[sheetName];

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });

      const mapped = mapExcelRowsToContestants(rawRows);

      setRows(mapped.contestants);
      setErrors(mapped.errors);

      if (!mapped.contestants.length && !mapped.errors.length) {
        setErrors(['Không đọc được dòng dữ liệu hợp lệ nào.']);
      }
    } catch (error) {
      console.error(error);
      setRows([]);
      setErrors(['Không đọc được file Excel. Hãy kiểm tra định dạng file.']);
    }
  }

  async function handleImport() {
    if (!rows.length) {
      setMessage('Chưa có dữ liệu hợp lệ để import.');
      return;
    }

    setImporting(true);
    setMessage(null);
    setResult(null);

    const response = await fetch('/api/admin/contestants/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? 'Import thất bại.');
      setImporting(false);
      return;
    }

    setResult(data);
    setMessage('Import thí sinh thành công.');
    setImporting(false);
  }

  return (
    <div className="stack-lg">
      <section className="content-grid-two">
        <div className="card-surface card-gradient">
          <div className="card-header">
            <h2 className="card-title">Mẫu cột Excel</h2>
            <p className="card-subtitle">
              File import gồm 3 cột: Số báo danh, Họ và tên, Link video. Link video có thể là link Google Drive.
            </p>
          </div>

          <div className="table-wrap compact-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SBD</th>
                  <th>Họ và tên</th>
                  <th>Link video</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td className="strong-cell">TEST001</td>
                  <td>Nguyễn Văn A</td>
                  <td>https://drive.google.com/file/d/.../view?usp=sharing</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            Trước khi import, hãy mở quyền video Google Drive ở chế độ: <strong>Anyone with the link can view</strong>.
          </div>
        </div>

        <div className="card-surface">
          <div className="card-header">
            <h2 className="card-title">Chọn file để import</h2>
            <p className="card-subtitle">
              Hỗ trợ .xlsx, .xls hoặc .csv. Hệ thống sẽ tự nhận các cột: SBD, Họ và tên, Link video.
            </p>
          </div>

          <div className="field-group">
            <label className="field-label">File Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="input file-input"
            />
          </div>

          {filename ? (
            <div className="alert alert-info">
              Đang đọc file: <strong>{filename}</strong>
            </div>
          ) : null}

          {errors.length ? (
            <div className="alert alert-warning">
              <p className="alert-title">Có lỗi cần xử lý trước khi import:</p>
              <ul className="list-stack">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="inline-summary">
            <div>
              <strong>Số dòng hợp lệ:</strong> {rows.length}
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !rows.length || errors.length > 0}
              className="btn btn-primary"
            >
              {importing ? 'Đang import...' : 'Import vào hệ thống'}
            </button>
          </div>

          {message ? <div className="alert alert-info">{message}</div> : null}

          {result ? (
            <div className="alert alert-success">
              <p>
                <strong>Tổng dòng xử lý:</strong> {result.total}
              </p>
              <p>
                <strong>Thêm mới:</strong> {result.inserted}
              </p>
              <p>
                <strong>Cập nhật:</strong> {result.updated}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card-surface">
        <div className="card-header">
          <h2 className="card-title">Xem trước dữ liệu</h2>
          <p className="card-subtitle">
            Hệ thống hiển thị tối đa 10 dòng đầu tiên để kiểm tra nhanh trước khi import.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SBD</th>
                <th>Họ và tên</th>
                <th>Link video</th>
              </tr>
            </thead>

            <tbody>
              {previewRows.length ? (
                previewRows.map((row) => (
                  <tr key={row.sbd}>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.full_name}</td>
                    <td style={{ maxWidth: 420, wordBreak: 'break-all' }}>
                      {row.video_path ?? ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty-cell" colSpan={3}>
                    Chưa có dữ liệu xem trước.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 10 ? <p className="table-note">Đang hiển thị 10 dòng đầu tiên.</p> : null}
      </section>
    </div>
  );
}
