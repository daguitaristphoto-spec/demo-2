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
  score_status: string;
  total_score?: number | null;
};

type Criterion = {
  id: string;
  title: string;
  description?: string | null;
  max_score: number;
  weight: number;
};

export default function JudgeLiveScoringPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [contestantId, setContestantId] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedContestant = useMemo(
    () => contestants.find((item) => item.contestant_id === contestantId),
    [contestants, contestantId]
  );

  const totalScore = useMemo(() => {
    const total10 = criteria.reduce((sum, criterion) => {
      return sum + Number(scores[criterion.id] || 0) * Number(criterion.weight);
    }, 0);

    return Math.round(total10 * 10 * 100) / 100;
  }, [scores, criteria]);

  useEffect(() => {
    loadSegments();
  }, []);

  useEffect(() => {
    if (segmentId) {
      loadContestants(segmentId);
      loadCriteria(segmentId);
    } else {
      setContestants([]);
      setCriteria([]);
      setContestantId("");
    }
  }, [segmentId]);

  useEffect(() => {
    setScores({});
    setStrengths("");
    setWeaknesses("");
    setNotes("");
    setMessage("");
  }, [contestantId]);

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

      const filtered = (json.segments || []).filter((item: Segment) =>
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

  async function loadCriteria(nextSegmentId: string) {
    setLoading(true);
    setMessage("");
    setScores({});

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

  function updateScore(criterionId: string, rawValue: string, maxScore: number) {
    const normalizedValue = rawValue.replace(",", ".").replace(/[^0-9.]/g, "");

    if (normalizedValue === "") {
      setScores((prev) => {
        const next = { ...prev };
        delete next[criterionId];
        return next;
      });
      return;
    }

    const dotCount = (normalizedValue.match(/\./g) || []).length;
    if (dotCount > 1) {
      return;
    }

    const numericValue = Number(normalizedValue);

    if (Number.isNaN(numericValue)) {
      return;
    }

    const safeMaxScore = Number(maxScore) || 10;

    if (numericValue > safeMaxScore) {
      setScores((prev) => ({
        ...prev,
        [criterionId]: String(safeMaxScore),
      }));
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
          strengths,
          weaknesses,
          notes,
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

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1>Chấm điểm trực tiếp vòng 2–3</h1>

      <p>
        Chọn vòng/chặng, chọn thí sinh, nhập điểm từng tiêu chí rồi bấm nộp điểm.
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
        <section style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 12 }}>
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
                    Trọng số: {Number(criterion.weight) * 100}% · Tối đa: {criterion.max_score}
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

          <section style={{ marginTop: 20 }}>
            <label>
              <strong>Điểm mạnh</strong>
            </label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              style={{ display: "block", width: "100%", minHeight: 80, marginTop: 8 }}
              disabled={loading}
            />
          </section>

          <section style={{ marginTop: 16 }}>
            <label>
              <strong>Điểm cần cải thiện</strong>
            </label>
            <textarea
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              style={{ display: "block", width: "100%", minHeight: 80, marginTop: 8 }}
              disabled={loading}
            />
          </section>

          <section style={{ marginTop: 16 }}>
            <label>
              <strong>Ghi chú khác</strong>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ display: "block", width: "100%", minHeight: 80, marginTop: 8 }}
              disabled={loading}
            />
          </section>

          <h3 style={{ marginTop: 20 }}>Tổng điểm tạm tính: {totalScore}</h3>

          <button
            onClick={submitScore}
            disabled={loading}
            style={{ marginTop: 12, padding: "10px 16px" }}
          >
            {loading ? "Đang nộp..." : "Nộp điểm"}
          </button>
        </section>
      )}

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </main>
  );
}
