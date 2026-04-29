"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Contestant = {
  id: string;
  sbd: string;
  full_name: string;
  total_score?: number;
};

type PairForm = {
  pairNo: number;
  contestantIds: string[];
};

type TieBreakInfo = {
  needsVote: boolean;
  sessionId: string;
  title: string;
  description: string;
  cutoffScore: number;
  slotsToFill: number;
  candidates: Contestant[];
};

export default function Round2PairsPage() {
  const [topContestants, setTopContestants] = useState<Contestant[]>([]);
  const [pairs, setPairs] = useState<PairForm[]>([]);
  const [tieBreak, setTieBreak] = useState<TieBreakInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const usedContestantIds = useMemo(() => {
    const ids = new Set<string>();

    for (const pair of pairs) {
      for (const contestantId of pair.contestantIds) {
        if (contestantId) ids.add(contestantId);
      }
    }

    return ids;
  }, [pairs]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/round2-pairs");
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được dữ liệu gán cặp");
        return;
      }

      const contestants = json.topContestants || [];
      setTopContestants(contestants);
      setTieBreak(json.tieBreak || null);

      if (json.tieBreak?.needsVote) {
        setPairs([]);
        setMessage(
          "Có thí sinh đồng điểm ở ngưỡng Top 30. Hệ thống đã tạo phiên vote. Cần giám khảo vote và admin chốt vote trước khi gán cặp."
        );
        return;
      }

      const existingPairs = json.pairs || [];

      if (existingPairs.length > 0) {
        setPairs(
          existingPairs.map((pair: any) => ({
            pairNo: pair.pair_no,
            contestantIds: (pair.members || [])
              .sort((a: any, b: any) => Number(a.position_no) - Number(b.position_no))
              .map((member: any) => member.contestant_id),
          }))
        );
      } else {
        autoCreatePairs(contestants);
      }
    } catch {
      setMessage("Có lỗi khi tải dữ liệu gán cặp");
    } finally {
      setLoading(false);
    }
  }

  function autoCreatePairs(sourceContestants = topContestants) {
    if (tieBreak?.needsVote) {
      setMessage("Cần chốt vote đồng điểm trước khi tự ghép cặp vòng 2.");
      return;
    }

    const nextPairs: PairForm[] = [];

    for (let index = 0; index < sourceContestants.length; index += 2) {
      nextPairs.push({
        pairNo: nextPairs.length + 1,
        contestantIds: [
          sourceContestants[index]?.id || "",
          sourceContestants[index + 1]?.id || "",
        ],
      });
    }

    setPairs(nextPairs);
  }

  function updatePair(pairIndex: number, positionIndex: number, contestantId: string) {
    setPairs((prev) =>
      prev.map((pair, index) => {
        if (index !== pairIndex) return pair;

        const nextContestantIds = [...pair.contestantIds];
        nextContestantIds[positionIndex] = contestantId;

        return {
          ...pair,
          contestantIds: nextContestantIds,
        };
      })
    );
  }

  function addPair() {
    if (tieBreak?.needsVote) {
      setMessage("Cần chốt vote đồng điểm trước khi thêm cặp vòng 2.");
      return;
    }

    setPairs((prev) => [
      ...prev,
      {
        pairNo: prev.length + 1,
        contestantIds: ["", ""],
      },
    ]);
  }

  function removePair(pairIndex: number) {
    setPairs((prev) =>
      prev
        .filter((_, index) => index !== pairIndex)
        .map((pair, index) => ({
          ...pair,
          pairNo: index + 1,
        }))
    );
  }

  function validatePairs() {
    const ids = new Set<string>();

    for (const pair of pairs) {
      if (!pair.contestantIds[0] || !pair.contestantIds[1]) {
        return "Mỗi cặp phải chọn đủ 2 thí sinh.";
      }

      if (pair.contestantIds[0] === pair.contestantIds[1]) {
        return `Cặp ${pair.pairNo} đang chọn trùng thí sinh.`;
      }

      for (const contestantId of pair.contestantIds) {
        if (ids.has(contestantId)) {
          return "Một thí sinh không được xuất hiện trong nhiều cặp.";
        }

        ids.add(contestantId);
      }
    }

    return "";
  }

  async function savePairs() {
    if (tieBreak?.needsVote) {
      setMessage("Cần chốt vote đồng điểm trước khi lưu danh sách cặp vòng 2.");
      return;
    }

    const errorMessage = validatePairs();

    if (errorMessage) {
      setMessage(errorMessage);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/round2-pairs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segmentId: "round2_semifinal",
          pairs: pairs.map((pair) => ({
            pairNo: pair.pairNo,
            contestantIds: pair.contestantIds,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không lưu được danh sách cặp");
        return;
      }

      setMessage("Đã lưu danh sách cặp vòng 2.");
      loadData();
    } catch {
      setMessage("Có lỗi khi lưu danh sách cặp");
    } finally {
      setLoading(false);
    }
  }

  function getContestantLabel(contestant: Contestant) {
    const scoreText =
      contestant.total_score === null || contestant.total_score === undefined
        ? ""
        : ` - ${Number(contestant.total_score).toFixed(2)} điểm`;

    return `${contestant.sbd} - ${contestant.full_name}${scoreText}`;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <p className="eyebrow">Speak Up DNU 2026</p>
          <h1>Gán cặp vòng 2</h1>
          <p>
            Hệ thống lấy tối đa 30 thí sinh có điểm cao nhất từ vòng 1. Admin ghép mỗi cặp gồm 2 thí sinh để giám khảo chấm đồng thời.
          </p>
        </div>

        <Link href="/admin" className="btn btn-secondary">
          Quay lại admin
        </Link>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Top thí sinh vòng 1</h2>
            <p style={{ marginTop: 6 }}>
              Đã tải: <strong>{topContestants.length}</strong> thí sinh.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => autoCreatePairs()}
            disabled={loading || topContestants.length === 0 || Boolean(tieBreak?.needsVote)}
          >
            Tự ghép theo thứ hạng
          </button>
        </div>

        {topContestants.length === 0 ? (
          <p style={{ marginTop: 16 }}>
            Chưa có dữ liệu top thí sinh vòng 1. Hãy nộp phiếu vòng 1 trước, sau đó quay lại trang này.
          </p>
        ) : null}

        {tieBreak?.needsVote ? (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 14,
              border: "1px solid rgba(245,158,11,0.55)",
              background: "rgba(245,158,11,0.16)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Cần vote xử lý đồng điểm</h3>

            <p>
              Có thí sinh đồng điểm ở ngưỡng Top 30 vòng 1. Hệ thống đã tạo phiên vote:
              <strong> {tieBreak.title}</strong>.
            </p>

            <p>
              Điểm ngưỡng: <strong>{Number(tieBreak.cutoffScore).toFixed(2)}</strong> · Số suất cần chọn:{" "}
              <strong>{tieBreak.slotsToFill}</strong>
            </p>

            <p>
              Sau khi 5 giám khảo vote xong, admin vào trang quản lý vote để chốt kết quả. Sau đó quay lại trang này và bấm tải lại.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <Link href="/admin/tie-breaks" className="btn btn-primary">
                Mở trang quản lý vote
              </Link>

              <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
                Tải lại sau khi chốt vote
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        className="card-surface"
        style={{
          marginTop: 24,
          opacity: tieBreak?.needsVote ? 0.55 : 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Danh sách cặp vòng 2</h2>
            <p style={{ marginTop: 6 }}>
              Mỗi cặp gồm 2 thí sinh. Khi giám khảo chấm vòng 2, hệ thống sẽ hiển thị 2 cột điểm song song.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={addPair}
            disabled={loading || Boolean(tieBreak?.needsVote)}
          >
            Thêm cặp
          </button>
        </div>

        {tieBreak?.needsVote ? (
          <p style={{ marginTop: 16, fontWeight: 700 }}>
            Đang tạm khóa chức năng gán cặp vì cần xử lý vote đồng điểm trước.
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          {pairs.map((pair, pairIndex) => (
            <div
              key={pair.pairNo}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Cặp {pair.pairNo}</h3>

                <button
                  type="button"
                  onClick={() => removePair(pairIndex)}
                  disabled={loading || Boolean(tieBreak?.needsVote)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Xóa cặp
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 14,
                }}
              >
                {[0, 1].map((positionIndex) => {
                  const selectedId = pair.contestantIds[positionIndex] || "";

                  return (
                    <label key={positionIndex} style={{ display: "block" }}>
                      <strong>Thí sinh {positionIndex + 1}</strong>

                      <select
                        value={selectedId}
                        onChange={(e) => updatePair(pairIndex, positionIndex, e.target.value)}
                        disabled={loading || Boolean(tieBreak?.needsVote)}
                        style={{
                          display: "block",
                          marginTop: 8,
                          width: "100%",
                          padding: 10,
                          borderRadius: 10,
                        }}
                      >
                        <option value="">-- Chọn thí sinh --</option>

                        {topContestants.map((contestant) => {
                          const isUsedElsewhere =
                            usedContestantIds.has(contestant.id) && contestant.id !== selectedId;

                          return (
                            <option key={contestant.id} value={contestant.id} disabled={isUsedElsewhere}>
                              {getContestantLabel(contestant)}
                              {isUsedElsewhere ? " - đã chọn" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={savePairs}
            disabled={loading || pairs.length === 0 || Boolean(tieBreak?.needsVote)}
          >
            {loading ? "Đang lưu..." : "Lưu danh sách cặp"}
          </button>

          {message ? <strong>{message}</strong> : null}
        </div>
      </section>
    </main>
  );
}
