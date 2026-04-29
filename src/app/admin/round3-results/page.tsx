import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";

const REQUIRED_JUDGE_COUNT = 5;

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

function isCompleteJudgeCount(count: number) {
  return count >= REQUIRED_JUDGE_COUNT;
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

  const segmentIds = ROUND3_SEGMENTS.map((item) => item.id);

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
    .in("segment_id", segmentIds)
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

  const rows: ContestantSummary[] = Array.from(grouped.values()).map((row) => {
    const stage1 = getAverage(row.stageScores.round3_stage1 ?? []);
    const stage2 = getAverage(row.stageScores.round3_stage2 ?? []);
    const stage3 = getAverage(row.stageScores.round3_stage3 ?? []);

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

  const stageRows: Record<string, ContestantSummary[]> = Object.fromEntries(
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

  const allFinalRowsHaveEnoughJudges =
    finalRows.length > 0 &&
    finalRows.every((row) =>
      ROUND3_SEGMENTS.every(
        (segment) => (row.stageScores[segment.id]?.length ?? 0) >= REQUIRED_JUDGE_COUNT
      )
    );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Tổng hợp điểm vòng 3</h1>
          <p>
            Vòng Chung kết gồm 3 chặng. Bảng dưới đây hiển thị điểm trung bình tạm tính
            theo số phiếu đã nộp. Kết quả chính thức chỉ nên chốt khi đủ 5 giám khảo.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/admin/round3-score-sheets/print"
            target="_blank"
            className="btn btn-primary"
          >
            Xuất phiếu PDF vòng 3
          </Link>

          <Link href="/admin/results" className="btn btn-secondary">
            Quay lại kết quả
          </Link>
        </div>
      </div>

      <section
        className="card-surface"
        style={{
          marginTop: 24,
          border: allFinalRowsHaveEnoughJudges
            ? "1px solid rgba(34,197,94,0.35)"
            : "1px solid rgba(245,158,11,0.45)",
        }}
      >
        <div className="card-header">
          <h3 className="card-title">
            {allFinalRowsHaveEnoughJudges
              ? "Đã đủ dữ liệu 5 giám khảo"
              : "Kết quả đang là tạm tính"}
          </h3>
          <p className="card-subtitle">
            Hệ thống chỉ hiển thị điểm trung bình theo số phiếu đã nộp. Nếu mới có 1 giám khảo test,
            điểm trung bình chính là điểm của giám khảo đó. Không nên dùng bảng này để công bố giải
            cho đến khi đủ 5/5 giám khảo và admin chốt điểm chính thức.
          </p>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Thao tác chuyển chặng</h3>
          <p className="card-subtitle">
            Sau khi chấm xong vòng 2, bấm nút đầu để lấy 10 thí sinh có điểm cao nhất vòng 2 vào vòng 3 chặng 1 và chặng 2.
            Sau khi chấm xong chặng 1 + 2, bấm nút thứ hai để lấy Top 3 vào chặng 3.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <form action="/api/admin/round3-promote" method="post">
            <input type="hidden" name="action" value="round2_to_stage12" />
            <input type="hidden" name="topN" value="10" />
            <button className="btn btn-primary" type="submit">
              Lấy Top 10 từ vòng 2 vào vòng 3
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
          <h3 className="card-title">Xếp hạng tạm thời sau chặng 1 + chặng 2</h3>
          <p className="card-subtitle">
            Bảng này dùng để theo dõi tạm thời. Chỉ dùng để chọn Top 3 khi đủ phiếu của 5 giám khảo.
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
                <th>Phiếu chặng 1</th>
                <th>Điểm TB chặng 2</th>
                <th>Phiếu chặng 2</th>
                <th>Tổng chặng 1 + 2</th>
                <th>Kết quả tạm</th>
              </tr>
            </thead>

            <tbody>
              {afterStage2Rows.map((row, index) => {
                const stage1Count = row.stageScores.round3_stage1?.length ?? 0;
                const stage2Count = row.stageScores.round3_stage2?.length ?? 0;
                const enoughVotes =
                  isCompleteJudgeCount(stage1Count) && isCompleteJudgeCount(stage2Count);

                return (
                  <tr
                    key={row.contestantId}
                    style={{
                      background:
                        index < 3 ? "rgba(22, 163, 74, 0.18)" : "transparent",
                    }}
                  >
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>{formatScore(row.stageAverages.round3_stage1)}</td>
                    <td>{stage1Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td>{formatScore(row.stageAverages.round3_stage2)}</td>
                    <td>{stage2Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td className="strong-cell">{formatScore(row.afterStage2Total)}</td>
                    <td>
                      {enoughVotes
                        ? index < 3
                          ? "Top 3 vào chặng 3"
                          : "-"
                        : "Tạm tính"}
                    </td>
                  </tr>
                );
              })}

              {afterStage2Rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có đủ dữ liệu chặng 1 và chặng 2.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {ROUND3_SEGMENTS.map((segment) => (
        <section
          key={segment.id}
          className="card-surface"
          style={{ marginTop: 24 }}
        >
          <div className="card-header">
            <h3 className="card-title">{segment.label}</h3>
            <p className="card-subtitle">
              Bảng điểm riêng của {segment.label.toLowerCase()} theo số phiếu đã nộp.
              Chỉ hiển thị điểm trung bình, không hiển thị điểm riêng từng giám khảo.
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
                  <th>Điểm TB tạm tính</th>
                </tr>
              </thead>

              <tbody>
                {(stageRows[segment.id] || []).map((row, index) => {
                  const voteCount = row.stageScores[segment.id]?.length ?? 0;

                  return (
                    <tr key={`${segment.id}-${row.contestantId}`}>
                      <td className="strong-cell">{index + 1}</td>
                      <td className="strong-cell">{row.sbd}</td>
                      <td>{row.fullName}</td>
                      <td>{voteCount}/{REQUIRED_JUDGE_COUNT}</td>
                      <td className="strong-cell">
                        {formatScore(row.stageAverages[segment.id])}
                      </td>
                    </tr>
                  );
                })}

                {(stageRows[segment.id] || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 24 }}>
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
          <h3 className="card-title">Xếp hạng chung cuộc tạm tính sau chặng 3</h3>
          <p className="card-subtitle">
            Tổng chung cuộc tạm tính = điểm TB chặng 1 + điểm TB chặng 2 + điểm TB chặng 3.
            Chỉ công bố giải khi đủ 5/5 giám khảo.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hạng tạm</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Chặng 1</th>
                <th>Phiếu 1</th>
                <th>Chặng 2</th>
                <th>Phiếu 2</th>
                <th>Chặng 3</th>
                <th>Phiếu 3</th>
                <th>Tổng tạm tính</th>
                <th>Giải</th>
              </tr>
            </thead>

            <tbody>
              {finalRows.map((row, index) => {
                const stage1Count = row.stageScores.round3_stage1?.length ?? 0;
                const stage2Count = row.stageScores.round3_stage2?.length ?? 0;
                const stage3Count = row.stageScores.round3_stage3?.length ?? 0;

                const enoughVotes =
                  isCompleteJudgeCount(stage1Count) &&
                  isCompleteJudgeCount(stage2Count) &&
                  isCompleteJudgeCount(stage3Count);

                const prize =
                  enoughVotes && index === 0
                    ? "Giải Nhất"
                    : enoughVotes && index === 1
                      ? "Giải Nhì"
                      : enoughVotes && index === 2
                        ? "Giải Ba"
                        : "Chưa chốt";

                return (
                  <tr key={`final-${row.contestantId}`}>
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>{formatScore(row.stageAverages.round3_stage1)}</td>
                    <td>{stage1Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td>{formatScore(row.stageAverages.round3_stage2)}</td>
                    <td>{stage2Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td>{formatScore(row.stageAverages.round3_stage3)}</td>
                    <td>{stage3Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td className="strong-cell">{formatScore(row.finalTotal)}</td>
                    <td>{prize}</td>
                  </tr>
                );
              })}

              {finalRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 24 }}>
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
