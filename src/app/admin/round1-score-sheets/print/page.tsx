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

function getGroupScore(group: any, itemMap: Map<string, number>) {
  return group.items.reduce((sum: number, item: any) => {
    return sum + Number(itemMap.get(item.key) ?? 0);
  }, 0);
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
          <h1>Chưa có phiếu chấm vòng 1 nào được nộp chính thức.</h1>
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
            <h2 className="sheet-subtitle">VÒNG 1: SƠ LOẠI - XUẤT CHINH</h2>

            <section className="info-section">
              <h3>I. THÔNG TIN CHUNG</h3>
              <div className="info-grid">
                <div>
                  <strong>Họ và tên thí sinh:</strong> {contestant?.full_name ?? '........................'}
                </div>
                <div>
                  <strong>SBD:</strong> {contestant?.sbd ?? '................'}
                </div>
                <div>
                  <strong>Vòng thi:</strong> Vòng 1 - Sơ loại
                </div>
                <div>
                  <strong>Giám khảo:</strong> {judge?.full_name ?? '........................'}
                </div>
              </div>
            </section>

            <section className="criteria-section">
              <h3>II. TIÊU CHÍ CHẤM THI</h3>

              <table className="print-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tiêu chí đánh giá</th>
                    <th>Mô tả chi tiết</th>
                    <th>Thang điểm</th>
                    <th>Trọng số</th>
                    <th>Điểm BGK</th>
                  </tr>
                </thead>

                <tbody>
                  {ROUND1_CRITERIA.map((group, groupIndex) => {
                    const groupScore = getGroupScore(group, itemMap);

                    return (
                      <tr key={group.key}>
                        <td>{groupIndex + 1}</td>
                        <td>{group.title}</td>
                        <td>
                          {group.items.map((item: any) => (
                            <div key={item.key}>
                              - {item.label} ({Number(itemMap.get(item.key) ?? 0)}/{item.max})
                            </div>
                          ))}
                        </td>
                        <td>10</td>
                        <td>{Math.round(Number(group.weight) * 100)}%</td>
                        <td>{formatScore(groupScore)}</td>
                      </tr>
                    );
                  })}

                  <tr>
                    <td colSpan={5}>
                      <strong>TỔNG ĐIỂM</strong>
                    </td>
                    <td>
                      <strong>{formatScore(sheet.total_score)} / 100</strong>
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
          padding: 18mm;
          background: white;
          color: #111827;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          page-break-after: always;
          font-family: "Times New Roman", Times, serif;
          font-size: 14px;
        }

        .top-header {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
          text-align: center;
          line-height: 1.5;
        }

        .sheet-title {
          margin-top: 32px;
          margin-bottom: 4px;
          text-align: center;
          font-size: 20px;
          font-weight: 700;
        }

        .sheet-subtitle {
          margin-top: 0;
          margin-bottom: 24px;
          text-align: center;
          font-size: 16px;
          font-weight: 700;
        }

        .info-section h3,
        .criteria-section h3 {
          margin-top: 18px;
          margin-bottom: 10px;
          font-size: 15px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
          line-height: 1.6;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        .print-table th,
        .print-table td {
          border: 1px solid #111827;
          padding: 6px;
          vertical-align: top;
        }

        .print-table th {
          text-align: center;
          font-weight: 700;
        }

        .print-table td:nth-child(1),
        .print-table td:nth-child(4),
        .print-table td:nth-child(5),
        .print-table td:nth-child(6) {
          text-align: center;
        }

        .signature-section {
          margin-top: 48px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          text-align: center;
        }

        .sheet-footer {
          margin-top: 24px;
          text-align: right;
          font-size: 12px;
          color: #6b7280;
        }

        .empty-state {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        @media print {
          body {
            background: white !important;
          }

          .print-root {
            padding: 0;
            background: white;
          }

          .print-toolbar {
            display: none !important;
          }

          .score-sheet-page {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 12mm;
            box-shadow: none;
            page-break-after: always;
          }

          .sheet-footer {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
