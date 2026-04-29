"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TieBreakCandidate = {
  id: string;
  contestantId: string;
  sbd: string;
  fullName: string;
  sourceScore: number;
};

type TieBreakSession = {
  id: string;
  transitionKey: string;
  title: string;
  description?: string | null;
  cutoffScore?: number | null;
  slotsToFill: number;
  createdAt: string;
  requiredJudgeCount: number;
  votedJudgeCount: number;
  candidates: TieBreakCandidate[];
  mySelectedContestantIds: string[];
};

function formatScore(value: any) {
  if (value === null || value === undefined) return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return numberValue.toFixed(2);
}

export default function JudgeTieBreaksPage() {
  const [sessions, setSessions] = useState<TieBreakSession[]>([]);
  const [selectedBySession, setSelectedBySession] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/judge/tie-breaks");
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được phiên vote");
        return;
      }

      const nextSessions = json.sessions || [];
      setSessions(nextSessions);

      const nextSelected: Record<string, string[]> = {};

      for (const session of nextSessions) {
        nextSelected[session.id] = session.mySelectedContestantIds || [];
      }

      setSelectedBySession(nextSelected);
    } catch {
      setMessage("Có lỗi khi tải phiên vote");
    } finally {
      setLoading(false);
    }
  }

  function toggleCandidate(session: TieBreakSession, contestantId: string) {
    setSelectedBySession((prev) => {
      const current = prev[session.id] || [];
      const exists = current.includes(contestantId);

      if (exists) {
        return {
          ...prev,
          [session.id]: current.filter((id) => id !== contestantId),
        };
      }

      if (current.length >= session.slotsToFill) {
        setMessage(`Phiên này chỉ được chọn tối đa ${session.slotsToFill} thí sinh.`);
        return prev;
      }

      return {
        ...prev,
        [session.id]: [...current, contestantId],
      };
    });
  }

  async function submitVote(session: TieBreakSession) {
    const contestantIds = selectedBySession[session.id] || [];

    if (contestantIds.length === 0) {
      setMessage("Bạn cần chọn ít nhất 1 thí sinh để vote.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/judge/tie-breaks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          contestantIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không gửi được phiếu vote");
        return;
      }

      setMessage(json.message || "Đã ghi nhận phiếu vote");
      await loadSessions();
    } catch {
      setMessage("Có lỗi khi gửi phiếu vote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Vote thí sinh đồng điểm</h1>
          <p>
            Khi có thí sinh đồng điểm ở ngưỡng vào vòng tiếp theo, giám khảo sẽ vote để chọn
            thí sinh được đi tiếp.
          </p>
        </div>

        <Link href="/judge" className="btn btn-secondary">
          Quay lại trang giám khảo
        </Link>
      </div>

      {message ? (
        <section className="card-surface" style={{ marginTop: 16 }}>
          <strong>{message}</strong>
        </section>
      ) : null}

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {sessions.map((session) => {
          const selectedIds = selectedBySession[session.id] || [];

          return (
            <section key={session.id} className="card-surface">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{session.title}</h3>
                  <p className="card-subtitle">
                    {session.description || "Chọn thí sinh theo đánh giá của bạn."}
                  </p>
                  <p className="card-subtitle">
                    Số suất cần chọn: <strong>{session.slotsToFill}</strong> · Điểm ngưỡng:{" "}
                    <strong>{formatScore(session.cutoffScore)}</strong> · Đã có{" "}
                    <strong>
                      {session.votedJudgeCount}/{session.requiredJudgeCount}
                    </strong>{" "}
                    giám khảo vote
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>SBD</th>
                      <th>Thí sinh</th>
                      <th>Điểm đang xét</th>
                    </tr>
                  </thead>

                  <tbody>
                    {session.candidates.map((candidate) => {
                      const checked = selectedIds.includes(candidate.contestantId);

                      return (
                        <tr key={candidate.contestantId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCandidate(session, candidate.contestantId)}
                            />
                          </td>
                          <td className="strong-cell">{candidate.sbd}</td>
                          <td>{candidate.fullName}</td>
                          <td>{formatScore(candidate.sourceScore)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                disabled={loading}
                onClick={() => submitVote(session)}
              >
                {loading ? "Đang gửi..." : "Gửi phiếu vote"}
              </button>
            </section>
          );
        })}

        {sessions.length === 0 ? (
          <section className="card-surface">
            <h3 className="card-title">Chưa có phiên vote nào đang mở</h3>
            <p className="card-subtitle">
              Khi admin phát hiện thí sinh đồng điểm ở ngưỡng loại, phiên vote sẽ xuất hiện tại đây.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
