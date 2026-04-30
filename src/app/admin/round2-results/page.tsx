import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { Round2UnlockButton } from "@/components/admin/round2-unlock-button";

const REQUIRED_JUDGE_COUNT = 5;
const ROUND3_QUALIFIED_LIMIT = 10;

function pickRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatScore(value: any) {
  if (value === null || value === undefined) return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return numberValue.toFixed(2);
}

type ContestantResult = {
  contestantId: string;
  sbd: string;
  fullName: string;
  pairNo: number | null;
  scores: number[];
  averageScore: number;
  totalJudges: number;
};

export default async function Round2ResultsPage() {
  const { supabase } = await requireRole("admin");

  const segmentId = "round2_semifinal";

  const { data: sheets, error } = await supabase
    .from("score_sheets")
    .select(`
      id,
      contestant_id,
      judge_id,
      pair_id,
      segment_id,
      status,
      total_score,
      contestant:contestants(id, sbd, full_name),
      judge:profiles(id, full_name, email),
      pair:round2_pairs(id, pair_no)
    `)
    .eq("segment_id", segmentId)
    .eq("status", "submitted")
    .order("total_score", { ascending: false });

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h1>Tổng hợp điểm vòng 2</h1>
        <p style={{ color: "red" }}>{error.message}</p>

        <Link href="/admin/results" className="btn btn-secondary">
          Quay lại kết quả
        </Link>
      </main>
    );
  }

  const grouped = new Map<string, ContestantResult>();

  for (const sheet of sheets ?? []) {
    const contestant = pickRelation((sheet as any).contestant);
    const pair = pickRelation((sheet as any).pair);

    if (!contestant?.id) continue;

    if (!grouped.has(contestant.id)) {
      grouped.set(contestant.id, {
        contestantId: contestant.id,
        sbd: contestant.sbd,
        fullName: contestant.full_name,
        pairNo: pair?.pair_no ?? null,
        scores: [],
        averageScore: 0,
        totalJudges: 0,
      });
    }

    const current = grouped.get(contestant.id)!;
    const score = Number((sheet as any).total_score ?? 0);

    current.scores.push(score);
  }

  const rows = Array.from(grouped.values())
    .map((row) => {
      const total = row.scores.reduce((sum, score) => sum + score, 0);
      const averageScore = row.scores.length > 0 ? total / row.scores.length : 0;

      return {
        ...row,
        averageScore,
        totalJudges: row.scores.length,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

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
          <h1>Tổng hợp điểm vòng 2</h1>
          <p>
            Bảng tổng hợp điểm vòng Bán kết - Vượt ải. Điểm hiển thị là điểm
            trung bình của các giám khảo đã nộp phiếu. Khi đủ 5/5 giám khảo,
            hệ thống sẽ xếp hạng theo điểm trung bình và lấy 10 thí sinh cao
            nhất vào vòng 3.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/results" className="btn btn-secondary">
            Quay lại kết quả
          </Link>

          <Link
            href="/admin/round2-score-sheets/print"
            className="btn btn-primary"
            target="_blank"
          >
            Xuất phiếu PDF vòng 2
          </Link>

          <Round2UnlockButton />
        </div>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Bảng xếp hạng vòng 2</h3>
          <p className="card-subtitle">
            Tổng số thí sinh đã có điểm: {rows.length}. Bảng này chỉ hiển thị
            điểm trung bình, không hiển thị điểm riêng từng giám khảo.
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Cặp</th>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Số GK đã chấm</th>
                <th>Điểm TB</th>
                <th>Trạng thái</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const rank = index + 1;
                const isComplete = row.totalJudges >= REQUIRED_JUDGE_COUNT;
                const isQualified =
                  isComplete && index < ROUND3_QUALIFIED_LIMIT;

                return (
                  <tr key={row.contestantId}>
                    <td className="strong-cell">{rank}</td>
                    <td>{row.pairNo ? `Cặp ${row.pairNo}` : "-"}</td>
                    <td className="strong-cell">{row.sbd}</td>
                    <td>{row.fullName}</td>
                    <td>
                      {row.totalJudges}/{REQUIRED_JUDGE_COUNT}
                    </td>
                    <td className="strong-cell">
                      {formatScore(row.averageScore)}
                    </td>
                    <td>
                      {!isComplete ? (
                        <span style={{ fontWeight: 700, color: "#fbbf24" }}>
                          Tạm tính
                        </span>
                      ) : isQualified ? (
                        <span style={{ fontWeight: 700, color: "#86efac" }}>
                          Vào vòng 3
                        </span>
                      ) : (
                        <span style={{ fontWeight: 700, color: "#94a3b8" }}>
                          Dừng tại vòng 2
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    Chưa có phiếu chấm vòng 2 nào được nộp chính thức.
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
