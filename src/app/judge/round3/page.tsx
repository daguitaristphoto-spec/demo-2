"use client";

import { useEffect, useMemo, useState } from "react";
import { CompleteRoundButton } from "@/components/judge/complete-round-button";

const ROUND3_STAGES = [
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
] as const;

type StageId = (typeof ROUND3_STAGES)[number]["id"];

type Contestant = {
  contestant_id: string;
  sbd: string;
  full_name: string;
  score_status?: string;
  total_score?: number | null;
};

type Criterion = {
  id: string;
  title: string;
  description?: string | null;
  max_score: number;
  weight: number;
};

type StageState = {
  contestants: Contestant[];
  error?: string;
};

const EMPTY_STAGE_STATES: Record<StageId, StageState> = {
  round3_stage1: { contestants: [] },
  round3_stage2: { contestants: [] },
  round3_stage3: { contestants: [] },
};

function getCriterionLabel(criterion: Criterion) {
  return criterion.description || criterion.title;
}

function getCriterionMeta(criterion: Criterion) {
  const groupTitle = criterion.description ? `${criterion.title} · ` : "";
  return `${groupTitle}Tối đa: ${criterion.max_score}`;
}

function getStageLabel(stageId: StageId | "") {
  return ROUND3_STAGES.find((stage) => stage.id === stageId)?.label || "";
}

function isSubmitted(contestant: Contestant) {
  return contestant.score_status === "submitted";
}

export default function JudgeRound3Page() {
  const [stageStates, setStageStates] =
    useState<Record<StageId, StageState>>(EMPTY_STAGE_STATES);
  const [activeStageId, setActiveStageId] = useState<StageId | "">("");
  const [contestantId, setContestantId] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const activeContestants = activeStageId
    ? stageStates[activeStageId]?.contestants || []
    : [];

  const selectedContestant = useMemo(
    () => activeContestants.find((item) => item.contestant_id === contestantId),
    [activeContestants, contestantId]
  );

  const totalScore = useMemo(() => {
    const total10 = criteria.reduce((sum, criterion) => {
      return sum + Number(scores[criterion.id] || 0) * Number(criterion.weight);
    }, 0);

    return Math.round(total10 * 10 * 100) / 100;
  }, [scores, criteria]);

  useEffect(() => {
    loadRound3State();
  }, []);

  useEffect(() => {
    setScores({});
    setMessage("");

    if (activeStageId) {
      loadCriteria(activeStageId);
    } else {
      setCriteria([]);
    }
  }, [activeStageId]);

  useEffect(() => {
    setScores({});
    setMessage("");
  }, [contestantId]);

  async function loadRound3State() {
    setLoading(true);
    setMessage("");

    try {
      const nextStageStates: Record<StageId, StageState> = {
        round3_stage1: { contestants: [] },
        round3_stage2: { contestants: [] },
        round3_stage3: { contestants: [] },
      };

      for (const stage of ROUND3_STAGES) {
        const res = await fetch(`/api/judge/scoring-queue?segmentId=${stage.id}`);
        const json = await res.json();

        if (res.ok) {
          nextStageStates[stage.id] = {
            contestants: json.contestants || [],
          };
        } else {
          nextStageStates[stage.id] = {
            contestants: [],
            error: json.error || "Không tải được danh sách thí sinh",
          };
        }
      }

      setStageStates(nextStageStates);

      const pendingStage = ROUND3_STAGES.find((stage) =>
        nextStageStates[stage.id].contestants.some((contestant) => !isSubmitted(contestant))
      );

      const latestAvailableStage = [...ROUND3_STAGES]
        .reverse()
        .find((stage) => nextStageStates[stage.id].contestants.length > 0);

      const nextActiveStageId = pendingStage?.id || latestAvailableStage?.id || "round3_stage1";
      const nextContestants = nextStageStates[nextActiveStageId].contestants;
      const firstPending =
        nextContestants.find((contestant) => !isSubmitted(contestant)) || nextContestants[0];

      setActiveStageId(nextActiveStageId);
      setContestantId(firstPending?.contestant_id || "");
    } catch {
      setMessage("Có lỗi khi tải dữ liệu vòng 3");
    } finally {
      setLoading(false);
    }
  }

  async function loadCriteria(stageId: StageId) {
    setLoading(true);
    setMessage("");
    setScores({});

    try {
      const res = await fetch(`/api/judge/criteria?segmentId=${stageId}`);
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được tiêu chí chấm");
        return;
      }

      setCriteria(json.criteria || []);
    } catch {
      setMessage("Có lỗi khi tải tiêu chí chấm");
    } finally {
      setLoading(false);
    }
  }

  function normalizeScore(rawValue: string, maxScore: number) {
    const normalizedValue = rawValue.replace(",", ".").replace(/[^0-9.]/g, "");

    if (normalizedValue === "") return "";

    const dotCount = (normalizedValue.match(/\./g) || []).length;
    if (dotCount > 1) return null;

    const numericValue = Number(normalizedValue);

    if (Number.isNaN(numericValue)) return null;

    const safeMaxScore = Number(maxScore) || 10;

    if (numericValue > safeMaxScore) return String(safeMaxScore);
    if (numericValue < 0) return "0";

    return normalizedValue;
  }

  function updateScore(criterionId: string, rawValue: string, maxScore: number) {
    const normalizedValue = normalizeScore(rawValue, maxScore);

    if (normalizedValue === null) return;

    if (normalizedValue === "") {
      setScores((prev) => {
        const next = { ...prev };
        delete next[criterionId];
        return next;
      });
      return;
    }

    setScores((prev) => ({
      ...prev,
      [criterionId]: normalizedValue,
    }));
  }

  function buildNumericScores() {
    return Object.fromEntries(
      Object.entries(scores).map(([criterionId, value]) => [
        criterionId,
        Number(value || 0),
      ])
    );
  }

  async function submitScore() {
    if (!activeStageId) {
      setMessage("Chưa có chặng vòng 3 đang mở");
      return;
    }

    if (!contestantId) {
      setMessage("Vui lòng chọn thí sinh");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/score-sheets/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segmentId: activeStageId,
          contestantId,
          scores: buildNumericScores(),
          submit: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không nộp được điểm");
        return;
      }

      setMessage(`Đã nộp điểm. Tổng điểm: ${json.totalScore}`);

      await loadRound3State();
    } catch {
      setMessage("Có lỗi khi nộp điểm");
    } finally {
      setLoading(false);
    }
  }

  function getStageStatus(stageId: StageId) {
    const contestants = stageStates[stageId]?.contestants || [];

    if (contestants.length === 0) {
      return "Chưa mở";
    }

    const pendingCount = contestants.filter((contestant) => !isSubmitted(contestant)).length;

    if (pendingCount === 0) {
      return "Đã hoàn tất";
    }

    if (stageId === activeStageId) {
      return "Đang chấm";
    }

    return `Còn ${pendingCount} thí sinh`;
  }

  function getEmptyMessage() {
    if (!activeStageId) return "Chưa có dữ liệu vòng 3.";

    if (activeStageId === "round3_stage1") {
      return "Chưa có thí sinh ở vòng 3. Admin cần lấy Top 10 từ vòng 2 vào vòng 3 trước.";
    }

    if (activeStageId === "round3_stage2") {
      return "Chưa có dữ liệu chặng 2.";
    }

    return "Chưa có Top 3 ở chặng 3. Admin cần lấy Top 3 sau chặng 1 + 2 trước.";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Chấm điểm vòng 3</h1>

      <p>
        Vòng 3 được chấm liên thông. Hệ thống tự mở chặng cần chấm, giám khảo không
        chọn chặng thủ công.
      </p>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {ROUND3_STAGES.map((stage) => {
          const isActive = stage.id === activeStageId;

          return (
            <div
              key={stage.id}
              style={{
                padding: 14,
                border: isActive ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                borderRadius: 12,
                opacity: stageStates[stage.id].contestants.length === 0 ? 0.55 : 1,
              }}
            >
              <strong>{stage.label}</strong>
              <br />
              <small>{getStageStatus(stage.id)}</small>
            </div>
          );
        })}
      </section>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 12,
        }}
      >
        <h2>{getStageLabel(activeStageId)}</h2>

        {activeContestants.length === 0 ? (
          <p style={{ marginTop: 12 }}>{getEmptyMessage()}</p>
        ) : (
          <>
            <section style={{ marginTop: 16 }}>
              <label>
                <strong>Thí sinh</strong>
              </label>

              <select
                value={contestantId}
                onChange={(e) => setContestantId(e.target.value)}
                style={{ display: "block", marginTop: 8, width: "100%", padding: 10 }}
                disabled={loading}
              >
                <option value="">-- Chọn thí sinh --</option>

                {activeContestants.map((contestant) => (
                  <option key={contestant.contestant_id} value={contestant.contestant_id}>
                    {contestant.sbd} - {contestant.full_name} - {contestant.score_status}
                  </option>
                ))}
              </select>
            </section>

            {selectedContestant ? (
              <section style={{ marginTop: 24 }}>
                <h3>
                  {selectedContestant.sbd} - {selectedContestant.full_name}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                  {criteria.map((criterion) => (
                    <label
                      key={criterion.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px",
                        gap: 16,
                        alignItems: "center",
                        padding: 12,
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 12,
                      }}
                    >
                      <span>
                        <strong>{getCriterionLabel(criterion)}</strong>
                        <br />
                        <small>{getCriterionMeta(criterion)}</small>
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={scores[criterion.id] ?? ""}
                        onChange={(e) =>
                          updateScore(criterion.id, e.target.value, Number(criterion.max_score))
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-"].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        disabled={loading}
                        style={{
                          width: "90px",
                          padding: "8px 10px",
                          borderRadius: 10,
                          textAlign: "center",
                        }}
                      />
                    </label>
                  ))}
                </div>

                <h3 style={{ marginTop: 20 }}>Tổng điểm tạm tính: {totalScore}</h3>

                <button
                  onClick={submitScore}
                  disabled={loading}
                  style={{ marginTop: 12, padding: "10px 16px" }}
                >
                  {loading ? "Đang nộp..." : "Nộp điểm"}
                </button>
              </section>
            ) : null}
          </>
        )}
      </section>

      <CompleteRoundButton roundKey="round3" label="Kết thúc chấm vòng 3" />

      {message && <p style={{ marginTop: 16, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
