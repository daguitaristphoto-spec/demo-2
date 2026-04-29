import Link from "next/link";
import { Fragment } from "react";
import { requireRole } from "@/lib/auth-guard";
import { PrintButton } from "@/components/admin/print-button";

const ROUND3_SEGMENTS = [
  {
    id: "round3_stage1",
    subtitle: "VÒNG CHUNG KẾT: MÃ ĐÁO THÀNH CÔNG",
    roundText: "Vòng chung kết",
    stageText: "Chặng thi: 01 - Khai ấn chiến mã",
  },
  {
    id: "round3_stage2",
    subtitle: "VÒNG CHUNG KẾT: MÃ ĐÁO THÀNH CÔNG",
    roundText: "Vòng chung kết",
    stageText: "Chặng thi: 02 - Bứt phá đường đua",
  },
  {
    id: "round3_stage3",
    subtitle: "VÒNG CHUNG KẾT: MÃ ĐÁO THÀNH CÔNG",
    roundText: "Vòng chung kết",
    stageText: "Chặng thi: 03 - Cán đích",
  },
] as const;

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatScore(value: any) {
  if (value === null || value === undefined) return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return numberValue.toFixed(2);
}

function formatMaxScore(value: any) {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

function getSegmentInfo(segmentId: string) {
  return ROUND3_SEGMENTS.find((segment) => segment.id === segmentId) ?? ROUND3_SEGMENTS[0];
}

function groupCriteria(criteria: any[]) {
  const groups: {
    title: string;
    items: any[];
  }[] = [];

  for (const criterion of criteria) {
    const existingGroup = groups.find((group) => group.title === criterion.title);

    if (existingGroup) {
      existingGroup.items.push(criterion);
    } else {
      groups.push({
        title: criterion.title,
        items: [criterion],
      });
    }
  }

  return groups;
}

function getGroupMax(group: { items: any[] }) {
  return group.items.reduce((sum: number, item: any) => {
    return sum + Number(item.max_score ?? 0);
  }, 0);
}

export default async function Round3ScoreSheetsPrintPage() {
  const { supabase } = await requireRole("admin");

  const segmentIds = ROUND3_SEGMENTS.map((segment) => segment.id);

  const { data: criteria, error: criteriaError } = await supabase
    .from("scoring_criteria")
    .select("id, segment_id, title, description, max_score, weight, order_no")
    .in("segment_id", segmentIds)
    .order("segment_id")
    .order("order_no");

  if (criteriaError) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <h1>Xuất phiếu chấm vòng 3</h1>
        <p style={{ color: "red" }}>{criteriaError.message}</p>
        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </main>
    );
  }

  const { data: sheets, error: sheetsError } = await supabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      judge_id,
      segment_id,
      status,
      total_score,
      contestant:contestants(id, sbd, full_name),
      judge:profiles(id, full_name, email)
    `)
    .in("segment_id", segmentIds)
    .eq("status", "submitted")
    .order("segment_id")
    .order("contestant_id")
    .order("judge_id");

  if (sheetsError) {
    return (
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <h1>Xuất phiếu chấm vòng 3</h1>
        <p style={{ color: "red" }}>{sheetsError.message}</p>
        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </main>
    );
  }

  const sheetRows = sheets ?? [];
  const sheetIds = sheetRows.map((sheet: any) => sheet.id);

  let scoreItems: any[] = [];

  if (sheetIds.length > 0) {
    const { data, error: scoreItemsError } = await supabase
      .from("score_items")
      .select("sheet_id, criterion_id, score")
      .in("sheet_id", sheetIds);

    if (scoreItemsError) {
      return (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          <h1>Xuất phiếu chấm vòng 3</h1>
          <p style={{ color: "red" }}>{scoreItemsError.message}</p>
          <Link href="/admin/results" className="btn btn-secondary">
            Quay lại kết quả
          </Link>
        </main>
      );
    }

    scoreItems = data ?? [];
  }

  const criteriaBySegment = new Map<string, any[]>();

  for (const criterion of criteria ?? []) {
    const segmentId = String(criterion.segment_id);

    if (!criteriaBySegment.has(segmentId)) {
      criteriaBySegment.set(segmentId, []);
    }

    criteriaBySegment.get(segmentId)?.push(criterion);
  }

  const itemsBySheet = new Map<string, Map<string, number>>();

  for (const item of scoreItems) {
    if (!itemsBySheet.has(item.sheet_id)) {
      itemsBySheet.set(item.sheet_id, new Map());
    }

    itemsBySheet.get(item.sheet_id)?.set(item.criterion_id, Number(item.score));
  }

  return (
    <main className="print-root">
      <div className="print-toolbar">
        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>

        <PrintButton label="In / Lưu PDF" />
      </div>

      {sheetRows.length === 0 ? (
        <section className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h1>Chưa có phiếu chấm vòng 3</h1>
          <p>
            Hiện chưa có phiếu chấm vòng 3 nào được nộp chính thức. Sau khi giám khảo
            nộp điểm các chặng chung kết, hệ thống sẽ tự hiển thị danh sách phiếu
            để in hoặc lưu PDF.
          </p>
          <Link href="/admin/results" className="empty-state-link">
            Quay lại trang kết quả
          </Link>
        </section>
      ) : null}

      {sheetRows.map((sheet: any, index: number) => {
        const contestant = pickRelation(sheet.contestant);
        const judge = pickRelation(sheet.judge);
        const segmentInfo = getSegmentInfo(String(sheet.segment_id));
        const itemMap = itemsBySheet.get(sheet.id) ?? new Map();
        const criteriaGroups = groupCriteria(criteriaBySegment.get(String(sheet.segment_id)) ?? []);

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
            <h2 className="sheet-subtitle">{segmentInfo.subtitle}</h2>

            <section className="info-section">
              <h3>I. THÔNG TIN CHUNG</h3>

              <div className="info-grid">
                <div>
                  <span>- </span>
                  <strong>Họ và tên thí sinh:</strong>{" "}
                  {contestant?.full_name ?? "........................"}
                </div>

                <div>
                  <span>- </span>
                  <strong>SBD:</strong> {contestant?.sbd ?? "................"}
                </div>

                <div>
                  <span>- </span>
                  <strong>Vòng thi:</strong> {segmentInfo.roundText}
                </div>

                <div>
                  <strong>{segmentInfo.stageText}</strong>
                </div>

                <div>
                  <span>- </span>
                  <strong>Giám khảo:</strong>{" "}
                  {judge?.full_name ?? "........................"}
                </div>
              </div>
            </section>

            <section className="criteria-section">
              <h3>II. Tiêu chí chấm thi:</h3>

              <table className="print-table">
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "52%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>STT</th>
                    <th>TIÊU CHÍ ĐÁNH GIÁ</th>
                    <th>
                      ĐIỂM TỐI ĐA
                      <br />
                      <span>(100)</span>
                    </th>
                    <th>ĐIỂM BGK</th>
                  </tr>
                </thead>

                <tbody>
                  {criteriaGroups.map((group, groupIndex) => {
                    const groupMax = getGroupMax(group);

                    return (
                      <Fragment key={group.title}>
                        <tr className="group-row">
                          <td className="stt-cell" rowSpan={group.items.length + 1}>
                            {groupIndex + 1}
                          </td>
                          <td className="group-title-cell">
                            <strong>{group.title}</strong>
                          </td>
                          <td className="max-score-cell">
                            <strong>{formatMaxScore(groupMax)}</strong>
                          </td>
                          <td className="score-cell"></td>
                        </tr>

                        {group.items.map((criterion: any) => (
                          <tr key={criterion.id} className="detail-row">
                            <td className="description-cell">
                              {criterion.description || criterion.title}
                            </td>
                            <td className="max-score-cell">...../{criterion.max_score}</td>
                            <td className="score-cell">
                              {formatScore(itemMap.get(criterion.id))}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  <tr className="total-row">
                    <td colSpan={3}>
                      <strong>TỔNG ĐIỂM</strong>
                    </td>

                    <td className="total-score-cell">
                      <strong>{formatScore(sheet.total_score)}</strong>
                      <span>/100</span>
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

        .stt-cell,
        .max-score-cell,
        .score-cell,
        .total-score-cell {
          text-align: center;
          vertical-align: middle;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .group-title-cell {
          text-align: center;
          font-weight: 700;
          vertical-align: middle;
        }

        .description-cell {
          text-align: left;
          vertical-align: middle;
        }

        .group-row td {
          font-weight: 700;
          text-align: center;
        }

        .detail-row td {
          font-weight: 400;
        }

        .score-cell {
          font-weight: 600;
        }

        .total-row td {
          text-align: center;
          font-weight: 700;
        }

        .total-score-cell {
          line-height: 1.1;
        }

        .total-score-cell strong {
          display: block;
          font-size: 13px;
        }

        .total-score-cell span {
          display: block;
          font-size: 11px;
          margin-top: 2px;
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
