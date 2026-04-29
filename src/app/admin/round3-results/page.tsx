import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";

const ROUND3_SEGMENTS = [
  {
    id: "round3_stage1",
    label: "Chặng 1: Khai ấn chiến mã",
  },
  {
    id: "round3_stage2",
    label: "Chặng 2: Bứt phá đường đua",
  },
  {
    id: "round3_stage3",
    label: "Chặng 3: Cán đích - Top 3",
  },
];

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatScore(value: any) {
  if (value === null || value === undefined) return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return numberValue.toFixed(2);
}

function getAverage(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type ContestantSummary = {
  contestantId: string;
  sbd: string;
  fullName: string;
  stageScores: Record<string, number[]>;
  stageAverages: Record<string, number | null>;
  afterStage2Total: number | null;
  finalTotal: number | null;
};

export default async function Round3ResultsPage() {
  const { supabase } = await requireRole("admin");

  const { data: sheets, error } = await supabase
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
    .in("segment_id", ROUND3_SEGMENTS.map((item) => item.id))
    .eq("status", "submitted")
    .order("segment_id")
    .order("total_score", { ascending: false });

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h1>Tổng hợp điểm vòng 3</h1>
        <p style={{ color: "red" }}>{error.message}</p>

        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </main>
    );
  }

  const grouped = new Map<string, ContestantSummary>();

  for (const sheet of sheets ?? []) {
    const contestant = pickRelation((sheet as any).contestant);

    if (!contestant?.id) continue;

    if (!grouped.has(contestant.id)) {
      grouped.set(contestant.id, {
        contestantId: contestant.id,
        sbd: contestant.sbd,
        fullName: contestant.full_name,
        stageScores: {
          round3_stage1: [],
          round3_stage2: [],
          round3_stage3: [],
        },
        stageAverages: {
          round3_stage1: null,
          round3_stage2: null,
          round3_stage3: null,
        },
        afterStage2Total: null,
        finalTotal: null,
      });
    }

    const current = grouped.get(contestant.id)!;
    const segmentId = String((sheet as any).segment_id);
    const score = Number((sheet as any).total_score ?? 0);

    if (!current.stageScores[segmentId]) {
      current.stageScores[segmentId] = [];
    }

    current.stageScores[segmentId].push(score);
  }

  const rows = Array.from(grouped.values()).map((row) => {
    const stage1 = getAverage(row.stageScores.round3_stage1);
    const stage2 = getAverage(row.stageScores.round3_stage2);
    const stage3 = getAverage(row.stageScores.round3_stage3);

    const afterStage2Total =
      stage1 !== null && stage2 !== null ? stage1 + stage2 : null;

    const finalTotal =
      stage1 !== null && stage2 !== null && stage3 !== null
        ? stage1 + stage2 + stage3
        : null;

    return {
      ...row,
      stageAverages: {
        round3_stage1: stage1,
        round3_stage2: stage2,
        round3_stage3: stage3,
      },
      afterStage2Total,
      finalTotal,
    };
  });

  const afterStage2Rows = [...rows]
    .filter((row) => row.afterStage2Total !== null)
    .sort((a, b) => Number(b.afterStage2Total) - Number(a.afterStage2Total));

  const finalRows = [...rows]
    .filter((row) => row.finalTotal !== null)
    .sort((a, b) => Number(b.finalTotal) - Number(a.finalTotal));

  const stageRows = Object.fromEntries(
    ROUND3_SEGMENTS.map((segment) => [
      segment.id,
      [...rows]
        .filter((row) => row.stageAverages[segment.id] !== null)
        .sort(
          (a, b) =>
            Number(b.stageAverages[segment.id]) -
            Number(a.stageAverages[segment.id])
        ),
    ])
  );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Tổng hợp điểm vòng 3</h1>
          <p>
            Vòng Chung kết gồm 3 chặng. Sau chặng 1 và chặng 2, hệ thống lấy 3 thí sinh có tổng điểm cao nhất vào chặng 3.
          </p>
        </div>

        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Thao tác chuyển chặng</h3>
          <p className="card-subtitle">
            Sau khi có kết quả vòng 2, bấm nút đầu để đưa Top 10 vào chặng 1 và chặng 2. Sau khi chấm xong chặng 1 + 2, bấm nút thứ hai để lấy Top 3 vào chặng 3.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <form action="/api/admin/round3-promote" method="post">
            <input type="hidden" name="action" value="round2_to_stage12" />
            <input type="hidden" name="topN" value="10" />
            <button className="btn btn-primary" type="submit">
              Lấy Top 10 vòng 2 vào chặng 1 + 2
            </button>
          </form>

          <form action="/api/admin/round3-promote" method="post">
            <input type="hidden" name="action" value="stage12_to_top3" />
            <input type="hidden" name="topN" value="3" />
            <button className="btn btn-secondary" type="submit">
              Lấy Top 3 sau chặng 1 + 2 vào chặng 3
            </button>
          </form>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Xếp hạng sau chặng 1 + chặng 2</h3>
          <p className="card-subtitle">
            Bảng này dùng để chọn 3 thí sinh vào chặng 3.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Điểm TB chặng 1</th>
                <th>Điểm TB chặng 2</th>
                <th>Tổng chặng 1 + 2</th>
                <th>Kết quả</th>
              </tr>
            </thead>

            <tbody>
              {afterStage2Rows.map((row, index) => (
                <tr
                  key={row.contestantId}
                  style={{
                    background:
                      index < 3
                        ? "rgba(22, 163, 74, 0.18)"
                        : "transparent",
                  }}
                >
                  <td className="strong-cell">{index + 1}</td>
                  <td className="strong-cell">{row.sbd}</td>
                  <td>{row.fullName}</td>
                  <td>{formatScore(row.stageAverages.round3_stage1)}</td>
                  <td>{formatScore(row.stageAverages.round3_stage2)}</td>
                  <td className="strong-cell">{formatScore(row.afterStage2Total)}</td>
                  <td>{index < 3 ? "Top 3 vào chặng 3" : "-"}</td>
                </tr>
              ))}

              {afterStage2Rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có đủ dữ liệu chặng 1 và chặng 2.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {ROUND3_SEGMENTS.map((segment) => (
        <section key={segment.id} className="card-surface" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">{segment.label}</h3>
            <p className="card-subtitle">
              Bảng xếp hạng riêng của {segment.label.toLowerCase()}.
            </p>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hạng</th>
                  <th>SBD</th>
                  <th>Thí sinh</th>
                  <th>Số phiếu</th>
                  <th>Điểm từng GK</th>
                  <th>Điểm TB</th>
                </tr>
              </thead>

              <tbody>
                {(stageRows[segment.id] || []).map((row: ContestantSummary, index: number) => (
                  <tr key={`${segment.id}-${row.contestantId}`}>
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>{row.stageScores[segment.id]?.length ?? 0}</td>
                    <td>{(row.stageScores[segment.id] || []).map((score) => formatScore(score)).join(" | ")}</td>
                    <td className="strong-cell">{formatScore(row.stageAverages[segment.id])}</td>
                  </tr>
                ))}

                {(stageRows[segment.id] || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                      Chưa có phiếu chấm ở chặng này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Xếp hạng chung cuộc sau chặng 3</h3>
          <p className="card-subtitle">
            Tổng chung cuộc = điểm TB chặng 1 + điểm TB chặng 2 + điểm TB chặng 3.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Chặng 1</th>
                <th>Chặng 2</th>
                <th>Chặng 3</th>
                <th>Tổng chung cuộc</th>
                <th>Giải dự kiến</th>
              </tr>
            </thead>

            <tbody>
              {finalRows.map((row, index) => {
                const prize =
                  index === 0
                    ? "Giải Nhất"
                    : index === 1
                      ? "Giải Nhì"
                      : index === 2
                        ? "Giải Ba"
                        : "-";

                return (
                  <tr key={`final-${row.contestantId}`}>
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>{formatScore(row.stageAverages.round3_stage1)}</td>
                    <td>{formatScore(row.stageAverages.round3_stage2)}</td>
                    <td>{formatScore(row.stageAverages.round3_stage3)}</td>
                    <td className="strong-cell">{formatScore(row.finalTotal)}</td>
                    <td>{prize}</td>
                  </tr>
                );
              })}

              {finalRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có đủ dữ liệu chặng 3 để xếp hạng chung cuộc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
