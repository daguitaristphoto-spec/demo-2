import { Fragment } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { ROUND1_CRITERIA } from '@/lib/round1-criteria';
import { PrintButton } from '@/components/admin/print-button';

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatScore(value: any) {
  if (value === null || value === undefined) return '-';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '-';
  return numberValue.toFixed(2);
}

function getGroupMax(group: any) {
  return group.items.reduce((sum: number, item: any) => sum + Number(item.max ?? 0), 0);
}

export default async function Round1ScoreSheetsPrintPage() {
  const { supabase } = await requireRole('admin');

  const { data: sheets, error } = await supabase
    .from('score_sheets')
    .select(`
      id,
      contestant_id,
      judge_id,
      status,
      total_score,
      contestant:contestants(id, sbd, full_name),
      judge:profiles(id, full_name, email)
    `)
    .eq('status', 'submitted')
    .or('segment_id.eq.round1_online,segment_id.is.null')
    .order('total_score', { ascending: false });

  if (error) {
    return (
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1>Xuất phiếu PDF vòng 1</h1>
        <p style={{ color: 'red' }}>{error.message}</p>
        <Link href="/admin" className="btn btn-secondary">
          Quay lại admin
        </Link>
      </main>
    );
  }

  const sheetRows = sheets ?? [];
  const sheetIds = sheetRows.map((sheet: any) => sheet.id);

  let scoreItems: any[] = [];

  if (sheetIds.length > 0) {
    const { data } = await supabase
      .from('score_items')
      .select('score_sheet_id, criterion_key, criterion_group, score')
      .in('score_sheet_id', sheetIds);

    scoreItems = data ?? [];
  }

  const itemsBySheet = new Map<string, Map<string, number>>();

  for (const item of scoreItems) {
    if (!itemsBySheet.has(item.score_sheet_id)) {
      itemsBySheet.set(item.score_sheet_id, new Map());
    }

    itemsBySheet.get(item.score_sheet_id)?.set(item.criterion_key, Number(item.score));
  }

  return (
    <main className="print-root">
      <div className="print-toolbar">
        <Link href="/admin/round1-results" className="btn btn-secondary">
          Quay lại tổng hợp
        </Link>

        <PrintButton label="In / Lưu PDF" />
      </div>

      {sheetRows.length === 0 ? (
        <section className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h1>Chưa có phiếu chấm vòng 1</h1>
          <p>
            Hiện chưa có phiếu chấm vòng 1 nào được nộp chính thức. Sau khi giám khảo
            nộp điểm, hệ thống sẽ tự hiển thị danh sách phiếu để in hoặc lưu PDF.
          </p>
          <Link href="/admin/results" className="empty-state-link">
            Quay lại trang kết quả
          </Link>
        </section>
      ) : null}

      {sheetRows.map((sheet: any, index: number) => {
        const contestant = pickRelation(sheet.contestant);
        const judge = pickRelation(sheet.judge);
        const itemMap = itemsBySheet.get(sheet.id) ?? new Map();

        return (
          <section className="score-sheet-page" key={sheet.id}>
            <div className="top-header">
              <div>
                <strong>TRƯỜNG ĐẠI HỌC ĐẠI NAM</strong>
                <br />
                <strong>KHOA TRUYỀN THÔNG</strong>
              </div>

              <div>
                <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
                <br />
                <span>Độc lập - Tự do - Hạnh phúc</span>
              </div>
            </div>

            <h1 className="sheet-title">PHIẾU CHẤM ĐIỂM THI</h1>
            <h2 className="sheet-subtitle">VÒNG SƠ LOẠI: XUẤT CHINH</h2>

            <section className="info-section">
              <h3>I. THÔNG TIN CHUNG</h3>

              <div className="info-grid">
                <div>
                  <span>- </span>
                  <strong>Họ và tên thí sinh:</strong>{' '}
                  {contestant?.full_name ?? '........................'}
                </div>

                <div>
                  <span>- </span>
                  <strong>SBD:</strong> {contestant?.sbd ?? '................'}
                </div>

                <div>
                  <span>- </span>
                  <strong>Vòng thi:</strong> Vòng 1 - Sơ loại
                </div>

                <div>
                  <span>- </span>
                  <strong>Chặng thi:</strong>
                </div>

                <div>
                  <span>- </span>
                  <strong>Giám khảo:</strong>{' '}
                  {judge?.full_name ?? '........................'}
                </div>
              </div>
            </section>

            <section className="criteria-section">
              <h3>II. Tiêu chí chấm thi:</h3>

              <table className="print-table">
                <colgroup>
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '49%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>STT</th>
                    <th>TIÊU CHÍ ĐÁNH GIÁ</th>
                    <th>
                      THANG ĐIỂM
                      <br />
                      <span>(Điểm tối đa 100 điểm)</span>
                    </th>
                    <th>ĐIỂM BGK</th>
                  </tr>
                </thead>

                <tbody>
                  {ROUND1_CRITERIA.map((group, groupIndex) => {
                    const groupMax = getGroupMax(group);

                    return (
                      <Fragment key={group.key}>
                        <tr className="group-row">
                          <td rowSpan={group.items.length + 1}>{groupIndex + 1}</td>
                          <td>
                            <strong>{group.title}</strong>
                          </td>
                          <td>
                            <strong>{groupMax}</strong>
                          </td>
                          <td></td>
                        </tr>

                        {group.items.map((item: any) => (
                          <tr key={item.key} className="detail-row">
                            <td>{item.label}</td>
                            <td>...../{item.max}</td>
                            <td>{formatScore(itemMap.get(item.key))}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  <tr className="total-row">
                    <td colSpan={2}>
                      <strong>TỔNG ĐIỂM</strong>
                    </td>
                    <td></td>
                    <td>
                      <strong>{formatScore(sheet.total_score)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="signature-section">
              <div>
                <strong>THƯ KÝ</strong>
                <br />
                <br />
                <br />
              </div>

              <div>
                <strong>GIÁM KHẢO</strong>
                <br />
                <br />
                <br />
              </div>
            </section>

            <div className="sheet-footer">
              Phiếu {index + 1} / {sheetRows.length}
            </div>
          </section>
        );
      })}

      <style>{`
        .print-root {
          background: #f3f4f6;
          padding: 24px;
          min-height: 100vh;
        }

        .print-toolbar {
          max-width: 900px;
          margin: 0 auto 20px auto;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .score-sheet-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px auto;
          padding: 16mm;
          background: white;
          color: #000000;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          page-break-after: always;
          font-family: "Times New Roman", Times, serif;
          font-size: 13px;
        }

        .top-header {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
          text-align: center;
          line-height: 1.35;
          font-size: 13px;
        }

        .sheet-title {
          margin-top: 28px;
          margin-bottom: 3px;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
        }

        .sheet-subtitle {
          margin-top: 0;
          margin-bottom: 18px;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
        }

        .info-section h3,
        .criteria-section h3 {
          margin-top: 12px;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 24px;
          line-height: 1.45;
        }

        .info-grid div:nth-child(5) {
          grid-column: 1 / 2;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          table-layout: fixed;
        }

        .print-table th,
        .print-table td {
          border: 1px solid #000000;
          padding: 4px 5px;
          vertical-align: middle;
          line-height: 1.22;
        }

        .print-table th {
          text-align: center;
          font-weight: 700;
        }

        .print-table th span {
          font-size: 11px;
          font-weight: 700;
        }

        .print-table td:nth-child(1),
        .print-table td:nth-child(3),
        .print-table td:nth-child(4) {
          text-align: center;
        }

        .group-row td {
          font-weight: 700;
          text-align: center;
        }

        .group-row td:nth-child(2) {
          text-align: center;
        }

        .detail-row td:nth-child(1) {
          text-align: left;
          font-weight: 400;
        }

        .detail-row td:nth-child(2),
        .detail-row td:nth-child(3) {
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        .total-row td {
          text-align: center;
          font-weight: 700;
        }

        .signature-section {
          margin-top: 42px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          text-align: center;
        }

        .sheet-footer {
          margin-top: 24px;
          text-align: right;
          font-size: 12px;
          color: #000000;
        }

        .empty-state {
          max-width: 900px;
          margin: 40px auto;
          background: #ffffff;
          color: #111827;
          padding: 36px 32px;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
          text-align: center;
          font-family: Arial, sans-serif;
        }

        .empty-state-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          font-size: 28px;
        }

        .empty-state h1 {
          margin: 0;
          color: #111827;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.3;
        }

        .empty-state p {
          max-width: 640px;
          margin: 12px auto 0 auto;
          color: #4b5563;
          font-size: 15px;
          line-height: 1.6;
        }

        .empty-state-link {
          display: inline-flex;
          margin-top: 22px;
          padding: 10px 16px;
          border-radius: 999px;
          background: #f59e0b;
          color: #111827;
          text-decoration: none;
          font-weight: 700;
          border: 1px solid #d97706;
        }

        @media print {
          html,
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            background: white !important;
          }

          .print-root {
            padding: 0;
            background: white;
            min-height: auto;
          }

          .print-toolbar {
            display: none !important;
          }

          .score-sheet-page,
          .score-sheet-page * {
            color: #000000 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            filter: none !important;
          }

          .score-sheet-page {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 11mm;
            box-shadow: none;
            page-break-after: always;
          }

          .print-table th,
          .print-table td {
            border-color: #000000 !important;
          }

          .sheet-footer {
            display: none;
          }

          .empty-state {
            box-shadow: none;
            border: 1px solid #000000;
            color: #000000;
            margin: 20mm auto;
          }

          .empty-state h1,
          .empty-state p {
            color: #000000 !important;
          }

          .empty-state-link,
          .empty-state-icon {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
