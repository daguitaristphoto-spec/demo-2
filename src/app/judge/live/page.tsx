"use client";

import { useEffect, useMemo, useState } from "react";

type Segment = {
  segment_id: string;
  round_name: string;
  stage_name?: string | null;
};

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

type Round2Pair = {
  id: string;
  pair_no: number;
  segment_id: string;
  members: {
    contestant_id: string;
    position_no: number;
    contestant: {
      id: string;
      sbd: string;
      full_name: string;
    };
    existing_score?: {
      totalScore: number;
      status: string;
      items: Record<string, number>;
    } | null;
  }[];
};

export default function JudgeLiveScoringPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [contestantId, setContestantId] = useState("");
  const [round2Pairs, setRound2Pairs] = useState<Round2Pair[]>([]);
  const [pairId, setPairId] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [pairScores, setPairScores] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isRound2 = segmentId === "round2_semifinal";

  const selectedContestant = useMemo(
    () => contestants.find((item) => item.contestant_id === contestantId),
    [contestants, contestantId]
  );

  const selectedPair = useMemo(
    () => round2Pairs.find((pair) => pair.id === pairId),
    [round2Pairs, pairId]
  );

  const totalScore = useMemo(() => {
    const total10 = criteria.reduce((sum, criterion) => {
      return sum + Number(scores[criterion.id] || 0) * Number(criterion.weight);
    }, 0);

    return Math.round(total10 * 10 * 100) / 100;
  }, [scores, criteria]);

  const pairTotals = useMemo(() => {
    if (!selectedPair) return {};

    const totals: Record<string, number> = {};

    for (const member of selectedPair.members) {
      const contestantId = member.contestant_id;
      const contestantScores = pairScores[contestantId] || {};

      const total10 = criteria.reduce((sum, criterion) => {
        return sum + Number(contestantScores[criterion.id] || 0) * Number(criterion.weight);
      }, 0);

      totals[contestantId] = Math.round(total10 * 10 * 100) / 100;
    }

    return totals;
  }, [selectedPair, pairScores, criteria]);

  useEffect(() => {
    loadSegments();
  }, []);

  useEffect(() => {
    setContestants([]);
    setContestantId("");
    setRound2Pairs([]);
    setPairId("");
    setScores({});
    setPairScores({});
    setMessage("");

    if (!segmentId) {
      setCriteria([]);
      return;
    }

    loadCriteria(segmentId);

    if (segmentId === "round2_semifinal") {
      loadRound2Pairs(segmentId);
    } else {
      loadContestants(segmentId);
    }
  }, [segmentId]);

  useEffect(() => {
    setScores({});
    setMessage("");
  }, [contestantId]);

  useEffect(() => {
    if (!selectedPair) {
      setPairScores({});
      return;
    }

    const seededScores: Record<string, Record<string, string>> = {};

    for (const member of selectedPair.members) {
      const existingItems = member.existing_score?.items || {};

      seededScores[member.contestant_id] = Object.fromEntries(
        Object.entries(existingItems).map(([criterionId, score]) => [
          criterionId,
          String(score),
        ])
      );
    }

    setPairScores(seededScores);
    setMessage("");
  }, [selectedPair]);

  async function loadSegments() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/judge/segments");
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được vòng thi");
        return;
      }

      const filtered = (json.segments || []).filter(
        (item: Segment) =>
          item.segment_id === "round2_semifinal" ||
          item.segment_id === "round3_stage1" ||
          item.segment_id === "round3_stage2" ||
          item.segment_id === "round3_stage3"
      );

      setSegments(filtered);
    } catch {
      setMessage("Có lỗi khi tải vòng thi");
    } finally {
      setLoading(false);
    }
  }

  async function loadContestants(nextSegmentId: string) {
    setLoading(true);
    setMessage("");
    setContestantId("");

    try {
      const res = await fetch(`/api/judge/scoring-queue?segmentId=${nextSegmentId}`);
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được danh sách thí sinh");
        return;
      }

      setContestants(json.contestants || []);
    } catch {
      setMessage("Có lỗi khi tải danh sách thí sinh");
    } finally {
      setLoading(false);
    }
  }

  async function loadRound2Pairs(nextSegmentId: string) {
    setLoading(true);
    setMessage("");
    setPairId("");

    try {
      const res = await fetch(`/api/judge/round2-pairs?segmentId=${nextSegmentId}`);
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được danh sách cặp vòng 2");
        return;
      }

      setRound2Pairs(json.pairs || []);
    } catch {
      setMessage("Có lỗi khi tải danh sách cặp vòng 2");
    } finally {
      setLoading(false);
    }
  }

  async function loadCriteria(nextSegmentId: string) {
    setLoading(true);
    setMessage("");
    setScores({});
    setPairScores({});

    try {
      const res = await fetch(`/api/judge/criteria?segmentId=${nextSegmentId}`);
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

    if (numericValue > safeMaxScore) {
      return String(safeMaxScore);
    }

    if (numericValue < 0) {
      return "0";
    }

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

  function updatePairScore(
    contestantId: string,
    criterionId: string,
    rawValue: string,
    maxScore: number
  ) {
    const normalizedValue = normalizeScore(rawValue, maxScore);

    if (normalizedValue === null) return;

    setPairScores((prev) => {
      const nextContestantScores = {
        ...(prev[contestantId] || {}),
      };

      if (normalizedValue === "") {
        delete nextContestantScores[criterionId];
      } else {
        nextContestantScores[criterionId] = normalizedValue;
      }

      return {
        ...prev,
        [contestantId]: nextContestantScores,
      };
    });
  }

  function buildNumericScores() {
    return Object.fromEntries(
      Object.entries(scores).map(([criterionId, value]) => [
        criterionId,
        Number(value || 0),
      ])
    );
  }

  function buildNumericPairScores() {
    const result: Record<string, Record<string, number>> = {};

    for (const [contestantId, contestantScores] of Object.entries(pairScores)) {
      result[contestantId] = Object.fromEntries(
        Object.entries(contestantScores).map(([criterionId, value]) => [
          criterionId,
          Number(value || 0),
        ])
      );
    }

    return result;
  }

  async function submitSingleScore() {
    if (!segmentId) {
      setMessage("Vui lòng chọn vòng/chặng thi");
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
          segmentId,
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
      loadContestants(segmentId);
    } catch {
      setMessage("Có lỗi khi nộp điểm");
    } finally {
      setLoading(false);
    }
  }

  async function submitPairScore() {
    if (!segmentId) {
      setMessage("Vui lòng chọn vòng/chặng thi");
      return;
    }

    if (!pairId || !selectedPair) {
      setMessage("Vui lòng chọn cặp thí sinh");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/score-sheets/submit-pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segmentId,
          pairId,
          scores: buildNumericPairScores(),
          submit: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không nộp được điểm");
        return;
      }

      const scoreText = selectedPair.members
        .map((member) => {
          const contestant = member.contestant;
          const total = json.totals?.[member.contestant_id];

          return `${contestant.sbd}: ${total}`;
        })
        .join(" | ");

      setMessage(`Đã nộp điểm cặp ${selectedPair.pair_no}. ${scoreText}`);
      loadRound2Pairs(segmentId);
    } catch {
      setMessage("Có lỗi khi nộp điểm cặp");
    } finally {
      setLoading(false);
    }
  }

  function renderRound2Scoring() {
    return (
      <>
        <section style={{ marginTop: 24 }}>
          <label>
            <strong>Cặp thí sinh</strong>
          </label>

          <select
            value={pairId}
            onChange={(e) => setPairId(e.target.value)}
            style={{ display: "block", marginTop: 8, width: "100%", padding: 10 }}
            disabled={loading}
          >
            <option value="">-- Chọn cặp thí sinh --</option>

            {round2Pairs.map((pair) => {
              const label = pair.members
                .map((member) => `${member.contestant?.sbd} - ${member.contestant?.full_name}`)
                .join("  &  ");

              return (
                <option key={pair.id} value={pair.id}>
                  Cặp {pair.pair_no}: {label}
                </option>
              );
            })}
          </select>
        </section>

        {round2Pairs.length === 0 ? (
          <p style={{ marginTop: 16 }}>
            Chưa có cặp vòng 2. Admin cần gán cặp tại trang /admin/round2-pairs trước.
          </p>
        ) : null}

        {selectedPair ? (
          <section
            style={{
              marginTop: 24,
              padding: 16,
              border: "1px solid #ccc",
              borderRadius: 12,
            }}
          >
            <h2>Cặp {selectedPair.pair_no}</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `1.4fr repeat(${selectedPair.members.length}, 1fr)`,
                gap: 12,
                alignItems: "center",
                marginTop: 16,
                fontWeight: 700,
              }}
            >
              <div>Tiêu chí</div>

              {selectedPair.members.map((member) => (
                <div key={member.contestant_id} style={{ textAlign: "center" }}>
                  {member.contestant?.sbd}
                  <br />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {member.contestant?.full_name}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1.4fr repeat(${selectedPair.members.length}, 1fr)`,
                    gap: 12,
                    alignItems: "center",
                    padding: 12,
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 12,
                  }}
                >
                  <div>
                    <strong>{criterion.title}</strong>
                    <br />
                    <small>
                      Trọng số: {Number(criterion.weight) * 100}% · Tối đa:{" "}
                      {criterion.max_score}
                    </small>
                  </div>

                  {selectedPair.members.map((member) => (
                    <div key={member.contestant_id} style={{ textAlign: "center" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pairScores[member.contestant_id]?.[criterion.id] ?? ""}
                        onChange={(e) =>
                          updatePairScore(
                            member.contestant_id,
                            criterion.id,
                            e.target.value,
                            Number(criterion.max_score)
                          )
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
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `1.4fr repeat(${selectedPair.members.length}, 1fr)`,
                gap: 12,
                marginTop: 20,
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Tổng điểm tạm tính</h3>

              {selectedPair.members.map((member) => (
                <h3 key={member.contestant_id} style={{ margin: 0, textAlign: "center" }}>
                  {pairTotals[member.contestant_id] ?? 0}
                </h3>
              ))}
            </div>

            <button
              onClick={submitPairScore}
              disabled={loading}
              style={{ marginTop: 20, padding: "10px 16px" }}
            >
              {loading ? "Đang nộp..." : "Nộp điểm cho cả cặp"}
            </button>
          </section>
        ) : null}
      </>
    );
  }

  function renderSingleScoring() {
    return (
      <>
        <section style={{ marginTop: 24 }}>
          <label>
            <strong>Thí sinh</strong>
          </label>

          <select
            value={contestantId}
            onChange={(e) => setContestantId(e.target.value)}
            style={{ display: "block", marginTop: 8, width: "100%", padding: 10 }}
            disabled={loading || !segmentId}
          >
            <option value="">-- Chọn thí sinh --</option>

            {contestants.map((contestant) => (
              <option key={contestant.contestant_id} value={contestant.contestant_id}>
                {contestant.sbd} - {contestant.full_name} - {contestant.score_status}
              </option>
            ))}
          </select>
        </section>

        {selectedContestant && (
          <section
            style={{
              marginTop: 24,
              padding: 16,
              border: "1px solid #ccc",
              borderRadius: 12,
            }}
          >
            <h2>
              {selectedContestant.sbd} - {selectedContestant.full_name}
            </h2>

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
                    <strong>{criterion.title}</strong>
                    <br />
                    <small>
                      Trọng số: {Number(criterion.weight) * 100}% · Tối đa:{" "}
                      {criterion.max_score}
                    </small>
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
              onClick={submitSingleScore}
              disabled={loading}
              style={{ marginTop: 12, padding: "10px 16px" }}
            >
              {loading ? "Đang nộp..." : "Nộp điểm"}
            </button>
          </section>
        )}
      </>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Chấm điểm trực tiếp vòng 2–3</h1>

      <p>
        Với vòng 2, giám khảo chọn cặp thí sinh và chấm đồng thời từng tiêu chí cho cả 2 thí sinh.
      </p>

      <section style={{ marginTop: 24 }}>
        <label>
          <strong>Vòng/chặng thi</strong>
        </label>

        <select
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
          style={{ display: "block", marginTop: 8, width: "100%", padding: 10 }}
          disabled={loading}
        >
          <option value="">-- Chọn vòng/chặng --</option>

          {segments.map((segment) => (
            <option key={segment.segment_id} value={segment.segment_id}>
              {segment.round_name}
              {segment.stage_name ? ` - ${segment.stage_name}` : ""}
            </option>
          ))}
        </select>
      </section>

      {segmentId ? (isRound2 ? renderRound2Scoring() : renderSingleScoring()) : null}

      {message && <p style={{ marginTop: 16, fontWeight: 700 }}>{message}</p>}
    </main>
  );
}
