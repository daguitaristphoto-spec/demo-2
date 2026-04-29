"use client";

import { useEffect, useState } from "react";

type JudgeStatus = {
  judgeId: string;
  fullName: string;
  email?: string | null;
  completed: boolean;
  completedAt?: string | null;
};

type RoundStatus = {
  roundKey: string;
  label: string;
  description: string;
  requiredJudgeCount: number;
  completedJudgeCount: number;
  readyToFinalize: boolean;
  judges: JudgeStatus[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

export function RoundCompletionStatus() {
  const [rounds, setRounds] = useState<RoundStatus[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/round-completions");
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được trạng thái kết thúc chấm");
        return;
      }

      setRounds(json.rounds || []);
    } catch {
      setMessage("Có lỗi khi tải trạng thái kết thúc chấm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card-surface" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <h3 className="card-title">Theo dõi trạng thái kết thúc chấm</h3>
          <p className="card-subtitle">
            Admin theo dõi số giám khảo đã bấm kết thúc chấm ở vòng 2 và vòng 3.
            Khi đủ 5/5 giám khảo, admin có thể chốt điểm trung bình chính thức.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadStatus}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {message ? <p style={{ color: "red", fontWeight: 700 }}>{message}</p> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        {rounds.map((round) => (
          <div
            key={round.roundKey}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 16,
              padding: 16,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div className="eyebrow">{round.label}</div>
                <h4 style={{ margin: "6px 0 4px" }}>{round.description}</h4>
                <p style={{ margin: 0, opacity: 0.85 }}>
                  Đã hoàn tất:{" "}
                  <strong>
                    {round.completedJudgeCount}/{round.requiredJudgeCount}
                  </strong>{" "}
                  giám khảo
                </p>
              </div>

              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: round.readyToFinalize
                    ? "rgba(22, 163, 74, 0.22)"
                    : "rgba(245, 158, 11, 0.18)",
                }}
              >
                {round.readyToFinalize ? "Đủ 5/5" : "Chưa đủ"}
              </span>
            </div>

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Giám khảo</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>

                <tbody>
                  {round.judges.map((judge) => (
                    <tr key={`${round.roundKey}-${judge.judgeId}`}>
                      <td>{judge.fullName}</td>
                      <td>
                        {judge.completed ? (
                          <span style={{ fontWeight: 700, color: "#86efac" }}>
                            Đã kết thúc
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: "#fbbf24" }}>
                            Chưa kết thúc
                          </span>
                        )}
                      </td>
                      <td>{formatDateTime(judge.completedAt)}</td>
                    </tr>
                  ))}

                  {round.judges.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 16 }}>
                        Chưa có tài khoản giám khảo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {round.readyToFinalize ? (
              <p style={{ marginTop: 12, fontWeight: 700 }}>
                Đã đủ giám khảo hoàn tất. Bước tiếp theo: chốt điểm trung bình chính thức.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
