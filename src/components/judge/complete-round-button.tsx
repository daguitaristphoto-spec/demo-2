"use client";

import { useEffect, useState } from "react";

type Props = {
  roundKey: "round2" | "round3";
  label: string;
};

type CompletionStatus = {
  completed: boolean;
  completedAt?: string | null;
  completedJudgeCount: number;
  requiredJudgeCount: number;
  readyToFinalize: boolean;
  canComplete: boolean;
  completenessMessage?: string;
};

export function CompleteRoundButton({ roundKey, label }: Props) {
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [roundKey]);

  async function loadStatus() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/judge/complete-round?roundKey=${roundKey}`);
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không kiểm tra được trạng thái kết thúc chấm");
        return;
      }

      setStatus(json);
    } catch {
      setMessage("Có lỗi khi kiểm tra trạng thái kết thúc chấm");
    } finally {
      setLoading(false);
    }
  }

  async function completeRound() {
    const confirmed = window.confirm(
      "Bạn xác nhận đã hoàn tất phần chấm của mình? Sau khi kết thúc, admin sẽ ghi nhận trạng thái hoàn tất của bạn."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/judge/complete-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roundKey }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không thể kết thúc chấm");
        await loadStatus();
        return;
      }

      setMessage(json.message || "Đã ghi nhận kết thúc chấm");
      await loadStatus();
    } catch {
      setMessage("Có lỗi khi kết thúc chấm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 12,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Kết thúc chấm</h3>

      {status ? (
        <p style={{ marginTop: 8 }}>
          Đã hoàn tất:{" "}
          <strong>
            {status.completedJudgeCount}/{status.requiredJudgeCount}
          </strong>{" "}
          giám khảo.
        </p>
      ) : null}

      {status?.completed ? (
        <p style={{ marginTop: 8, fontWeight: 700 }}>
          Bạn đã bấm kết thúc chấm
          {status.completedAt ? ` lúc ${new Date(status.completedAt).toLocaleString("vi-VN")}` : ""}.
        </p>
      ) : (
        <p style={{ marginTop: 8 }}>
          {status?.completenessMessage ||
            "Sau khi nộp đủ điểm, bạn có thể bấm kết thúc chấm."}
        </p>
      )}

      {status?.readyToFinalize ? (
        <p style={{ marginTop: 8, fontWeight: 700 }}>
          Đã đủ giám khảo hoàn tất. Admin có thể chốt điểm trung bình chính thức.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary"
        onClick={completeRound}
        disabled={loading || Boolean(status?.completed) || status?.canComplete === false}
        style={{ marginTop: 12 }}
      >
        {loading ? "Đang xử lý..." : label}
      </button>

      {message ? <p style={{ marginTop: 12, fontWeight: 700 }}>{message}</p> : null}
    </section>
  );
}
