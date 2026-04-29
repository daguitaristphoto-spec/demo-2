"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate = {
  id: string;
  contestantId: string;
  sbd: string;
  fullName: string;
  sourceScore: number;
  voteCount: number;
  selected: boolean;
};

type Session = {
  id: string;
  transitionKey: string;
  title: string;
  description?: string | null;
  status: string;
  cutoffScore?: number | null;
  slotsToFill: number;
  createdAt: string;
  closedAt?: string | null;
  requiredJudgeCount: number;
  votedJudgeCount: number;
  candidates: Candidate[];
};

function formatScore(value: any) {
  if (value === null || value === undefined) return "-";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "-";
  return numberValue.toFixed(2);
}

function getStatusLabel(status: string) {
  if (status === "open") return "Đang mở";
  if (status === "closed") return "Đã chốt";
  if (status === "cancelled") return "Đã hủy";
  return status;
}

export default function AdminTieBreaksPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/tie-breaks");
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được danh sách phiên vote");
        return;
      }

      setSessions(json.sessions || []);
    } catch {
      setMessage("Có lỗi khi tải danh sách phiên vote");
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(sessionId: string, action: "close" | "cancel") {
    const confirmed = window.confirm(
      action === "close"
        ? "Bạn chắc chắn muốn chốt kết quả vote này?"
        : "Bạn chắc chắn muốn hủy phiên vote này?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/tie-breaks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, action }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không xử lý được phiên vote");
        return;
      }

      setMessage(json.message || "Đã xử lý phiên vote");
      await loadSessions();
    } catch {
      setMessage("Có lỗi khi xử lý phiên vote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Quản lý vote đồng điểm</h1>
          <p>
            Admin theo dõi các phiên vote khi thí sinh đồng điểm ở ngưỡng vào vòng tiếp theo.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadSessions}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "Tải lại"}
          </button>

          <Link href="/admin/results" className="btn btn-secondary">
            Quay lại kết quả
          </Link>
        </div>
      </div>

      {message ? (
        <section className="card-surface" style={{ marginTop: 16 }}>
          <strong>{message}</strong>
        </section>
      ) : null}

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        {sessions.map((session) => (
          <section key={session.id} className="card-surface">
            <div className="card-header">
              <div>
                <div className="eyebrow">{getStatusLabel(session.status)}</div>
                <h3 className="card-title">{session.title}</h3>
                <p className="card-subtitle">
                  {session.description || "Phiên vote đồng điểm"}
                </p>
                <p className="card-subtitle">
                  Số suất cần chọn: <strong>{session.slotsToFill}</strong> · Điểm ngưỡng:{" "}
                  <strong>{formatScore(session.cutoffScore)}</strong> · Giám khảo đã vote:{" "}
                  <strong>
                    {session.votedJudgeCount}/{session.requiredJudgeCount}
                  </strong>
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hạng vote</th>
                    <th>SBD</th>
                    <th>Thí sinh</th>
                    <th>Điểm đang xét</th>
                    <th>Số phiếu vote</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>

                <tbody>
                  {session.candidates.map((candidate, index) => (
                    <tr
                      key={candidate.contestantId}
                      style={{
                        background: candidate.selected
                          ? "rgba(22, 163, 74, 0.18)"
                          : "transparent",
                      }}
                    >
                      <td className="strong-cell">{index + 1}</td>
                      <td className="strong-cell">{candidate.sbd}</td>
                      <td>{candidate.fullName}</td>
                      <td>{formatScore(candidate.sourceScore)}</td>
                      <td className="strong-cell">{candidate.voteCount}</td>
                      <td>{candidate.selected ? "Được chọn" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {session.status === "open" ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={() => submitAction(session.id, "close")}
                >
                  Chốt kết quả vote
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={loading}
                  onClick={() => submitAction(session.id, "cancel")}
                >
                  Hủy phiên vote
                </button>
              </div>
            ) : null}
          </section>
        ))}

        {sessions.length === 0 ? (
          <section className="card-surface">
            <h3 className="card-title">Chưa có phiên vote đồng điểm</h3>
            <p className="card-subtitle">
              Khi hệ thống phát hiện đồng điểm ở ngưỡng loại, phiên vote sẽ xuất hiện tại đây.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
