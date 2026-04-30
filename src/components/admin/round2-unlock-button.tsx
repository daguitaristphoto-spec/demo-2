"use client";

import { useState } from "react";

export function Round2UnlockButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function unlockRound2Scores() {
    const confirmed = window.confirm(
      "Bạn có chắc muốn mở khóa toàn bộ điểm vòng 2 không? Giám khảo sẽ có thể sửa và nộp lại điểm."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/round2-scores/unlock", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không mở khóa được điểm vòng 2");
        return;
      }

      setMessage(`Đã mở khóa ${json.unlockedCount || 0} phiếu điểm vòng 2.`);

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch {
      setMessage("Có lỗi khi mở khóa điểm vòng 2");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={unlockRound2Scores}
        disabled={loading}
        style={{
          borderColor: "rgba(239, 68, 68, 0.55)",
          color: "#fecaca",
        }}
      >
        {loading ? "Đang mở khóa..." : "Mở khóa điểm vòng 2"}
      </button>

      {message ? (
        <small style={{ color: message.includes("Đã") ? "#86efac" : "#fecaca" }}>
          {message}
        </small>
      ) : null}
    </div>
  );
}
