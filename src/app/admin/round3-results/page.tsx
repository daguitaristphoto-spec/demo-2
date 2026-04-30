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

function sortBySbd(a: ContestantSummary, b: ContestantSummary) {
  return String(a.sbd || "").localeCompare(String(b.sbd || ""), "vi", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortByScoreThenSbd(
  scoreA: number | null,
  scoreB: number | null,
  rowA: ContestantSummary,
  rowB: ContestantSummary
) {
  if (scoreA !== null && scoreB !== null && scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  if (scoreA !== null && scoreB === null) return -1;
  if (scoreA === null && scoreB !== null) return 1;

  return sortBySbd(rowA, rowB);
}

type ContestantSummary = {
  contestantId: string;
  sbd: string;
  fullName: string;
  stageMembership: Record<string, boolean>;
  stageScores: Record<string, number[]>;
  stageAverages: Record<string, number | null>;
  afterStage2Total: number | null;
  finalTotal: number | null;
};

function createEmptyContestantSummary(
  contestantId: string,
  sbd: string,
  fullName: string
): ContestantSummary {
  return {
    contestantId,
    sbd,
    fullName,
    stageMembership: {
      round3_stage1: false,
      round3_stage2: false,
      round3_stage3: false,
    },
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
  };
}

export default async function Round3ResultsPage() {
  const { supabase } = await requireRole("admin");

  const segmentIds = ROUND3_SEGMENTS.map((item) => item.id);

  const { data: segmentContestants, error: segmentContestantsError } =
    await supabase
      .from("segment_contestants")
      .select("segment_id, contestant_id")
      .in("segment_id", segmentIds);

  if (segmentContestantsError) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h1>Tổng hợp điểm vòng 3</h1>
        <p style={{ color: "red" }}>{segmentContestantsError.message}</p>

        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </main>
    );
  }

  const segmentContestantIds: string[] = Array.from(
    new Set(
      (segmentContestants || []).map((row: any) => String(row.contestant_id))
    )
  );

  let contestantsById = new Map<string, any>();

  if (segmentContestantIds.length > 0) {
    const { data: contestants, error: contestantsError } = await supabase
      .from("contestants")
      .select("id, sbd, full_name")
      .in("id", segmentContestantIds);

    if (contestantsError) {
      return (
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
          <h1>Tổng hợp điểm vòng 3</h1>
          <p style={{ color: "red" }}>{contestantsError.message}</p>

          <Link href="/admin/results" className="btn btn-secondary">
            Quay lại kết quả
          </Link>
        </main>
      );
    }

    contestantsById = new Map(
      (contestants || []).map((contestant: any) => [
        String(contestant.id),
        contestant,
      ])
    );
  }

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

  for (const row of segmentContestants || []) {
    const segmentId = String((row as any).segment_id);
    const contestantId = String((row as any).contestant_id);
    const contestant = contestantsById.get(contestantId);

    if (!contestant) continue;

    if (!grouped.has(contestantId)) {
      grouped.set(
        contestantId,
        createEmptyContestantSummary(
          contestantId,
          contestant.sbd || "",
          contestant.full_name || ""
        )
      );
    }

    const current = grouped.get(contestantId)!;
    current.stageMembership[segmentId] = true;
  }

  for (const sheet of sheets ?? []) {
    const contestant = pickRelation((sheet as any).contestant);
    const contestantId = String((sheet as any).contestant_id);
    const segmentId = String((sheet as any).segment_id);
    const score = Number((sheet as any).total_score ?? 0);

    if (!contestantId) continue;

    if (!grouped.has(contestantId)) {
      grouped.set(
        contestantId,
        createEmptyContestantSummary(
          contestantId,
          contestant?.sbd || "",
          contestant?.full_name || ""
        )
      );
    }

    const current = grouped.get(contestantId)!;

    current.stageMembership[segmentId] = true;

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

  const round3Entrants = [...rows]
    .filter(
      (row) =>
        row.stageMembership.round3_stage1 ||
        row.stageMembership.round3_stage2
    )
    .sort(sortBySbd);

  const afterStage2Rows = [...rows]
    .filter(
      (row) =>
        row.stageMembership.round3_stage1 ||
        row.stageMembership.round3_stage2 ||
        row.afterStage2Total !== null
    )
    .sort((a, b) =>
      sortByScoreThenSbd(a.afterStage2Total, b.afterStage2Total, a, b)
    );

  const finalRows = [...rows]
    .filter(
      (row) =>
        row.stageMembership.round3_stage3 ||
        row.finalTotal !== null
    )
    .sort((a, b) => sortByScoreThenSbd(a.finalTotal, b.finalTotal, a, b));

  const stageRows: Record<string, ContestantSummary[]> = Object.fromEntries(
    ROUND3_SEGMENTS.map((segment) => [
      segment.id,
      [...rows]
        .filter(
          (row) =>
            row.stageMembership[segment.id] ||
            row.stageAverages[segment.id] !== null
        )
        .sort((a, b) =>
          sortByScoreThenSbd(
            a.stageAverages[segment.id],
            b.stageAverages[segment.id],
            a,
            b
          )
        ),
    ])
  );

  const allFinalRowsHaveEnoughJudges =
    finalRows.length > 0 &&
    finalRows.every((row) =>
      ROUND3_SEGMENTS.every(
        (segment) =>
          (row.stageScores[segment.id]?.length ?? 0) >= REQUIRED_JUDGE_COUNT
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
            Vòng Chung kết gồm 3 chặng. Bảng dưới đây hiển thị danh sách thí sinh
            đã vào vòng 3 và điểm trung bình tạm tính theo số phiếu đã nộp.
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
            Hệ thống hiển thị cả thí sinh đã được đưa vào vòng 3 nhưng chưa có phiếu chấm.
            Khi chưa chấm, điểm sẽ hiển thị là dấu "-".
          </p>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Thao tác chuyển chặng</h3>
          <p className="card-subtitle">
            Sau khi chấm xong vòng 2, bấm nút đầu để lấy 10 thí sinh có điểm cao nhất vòng 2
            vào vòng 3 chặng 1 và chặng 2. Sau khi chấm xong chặng 1 + 2, bấm nút thứ hai
            để lấy Top 3 vào chặng 3.
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
          <h3 className="card-title">Danh sách thí sinh đã vào vòng 3</h3>
          <p className="card-subtitle">
            Tổng số thí sinh đã được đưa vào vòng 3: {round3Entrants.length}.
            Danh sách này lấy từ bảng phân chặng, nên vẫn hiển thị dù chưa có điểm chấm.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Chặng 1</th>
                <th>Chặng 2</th>
                <th>Phiếu chặng 1</th>
                <th>Phiếu chặng 2</th>
              </tr>
            </thead>

            <tbody>
              {round3Entrants.map((row, index) => {
                const stage1Count = row.stageScores.round3_stage1?.length ?? 0;
                const stage2Count = row.stageScores.round3_stage2?.length ?? 0;

                return (
                  <tr key={`entrant-${row.contestantId}`}>
                    <td className="strong-cell">{index + 1}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>
                      {row.stageMembership.round3_stage1 ? (
                        <span style={{ color: "#86efac", fontWeight: 700 }}>
                          Đã mở
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {row.stageMembership.round3_stage2 ? (
                        <span style={{ color: "#86efac", fontWeight: 700 }}>
                          Đã mở
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{stage1Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td>{stage2Count}/{REQUIRED_JUDGE_COUNT}</td>
                  </tr>
                );
              })}

              {round3Entrants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có thí sinh nào được đưa vào vòng 3. Hãy bấm nút
                    "Lấy Top 10 từ vòng 2 vào vòng 3".
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Xếp hạng tạm thời sau chặng 1 + chặng 2</h3>
          <p className="card-subtitle">
            Bảng này dùng để theo dõi tạm thời. Khi chưa có điểm, hệ thống vẫn hiển thị
            thí sinh nhưng điểm sẽ là "-".
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
                  isCompleteJudgeCount(stage1Count) &&
                  isCompleteJudgeCount(stage2Count);

                return (
                  <tr
                    key={`after-stage2-${row.contestantId}`}
                    style={{
                      background:
                        row.afterStage2Total !== null && index < 3
                          ? "rgba(22, 163, 74, 0.18)"
                          : "transparent",
                    }}
                  >
                    <td className="strong-cell">
                      {row.afterStage2Total !== null ? index + 1 : "-"}
                    </td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>{formatScore(row.stageAverages.round3_stage1)}</td>
                    <td>{stage1Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td>{formatScore(row.stageAverages.round3_stage2)}</td>
                    <td>{stage2Count}/{REQUIRED_JUDGE_COUNT}</td>
                    <td className="strong-cell">
                      {formatScore(row.afterStage2Total)}
                    </td>
                    <td>
                      {row.afterStage2Total === null
                        ? "Chưa đủ dữ liệu"
                        : enoughVotes
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
                    Chưa có thí sinh ở vòng 3 chặng 1 và chặng 2.
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
              Nếu đã mở chặng nhưng chưa chấm, thí sinh vẫn được hiển thị với số phiếu 0/5.
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
                  const hasScore = row.stageAverages[segment.id] !== null;

                  return (
                    <tr key={`${segment.id}-${row.contestantId}`}>
                      <td className="strong-cell">{hasScore ? index + 1 : "-"}</td>
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
                      Chưa có thí sinh hoặc phiếu chấm ở chặng này.
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
                  row.finalTotal === null
                    ? "Chưa đủ dữ liệu"
                    : enoughVotes && index === 0
                      ? "Giải Nhất"
                      : enoughVotes && index === 1
                        ? "Giải Nhì"
                        : enoughVotes && index === 2
                          ? "Giải Ba"
                          : "Chưa chốt";

                return (
                  <tr key={`final-${row.contestantId}`}>
                    <td className="strong-cell">
                      {row.finalTotal !== null ? index + 1 : "-"}
                    </td>
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
                    Chưa có Top 3 ở chặng 3 để xếp hạng chung cuộc.
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
