// src/app/admin/judge-assignments/page.tsx
// Trang admin phân công giám khảo theo vòng/chặng.
// Đây là bản khung, có thể chỉnh className để khớp giao diện hiện tại.

"use client";

import { useEffect, useState } from "react";

type Segment = {
  id: string;
  name: string;
  stage_name?: string | null;
};

type Judge = {
  id: string;
  full_name: string;
  email?: string;
  role: string;
};

export default function JudgeAssignmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (segmentId) loadAssignedJudges(segmentId);
  }, [segmentId]);

  async function loadInitialData() {
    const segmentsRes = await fetch("/api/admin/segments");
    const segmentsJson = await segmentsRes.json();
    setSegments(segmentsJson.segments || []);

    const judgesRes = await fetch("/api/admin/judges");
    const judgesJson = await judgesRes.json();
    setJudges(judgesJson.judges || []);
  }

  async function loadAssignedJudges(nextSegmentId: string) {
    const res = await fetch(`/api/admin/segment-judges?segmentId=${nextSegmentId}`);
    const json = await res.json();

    const ids = (json.judges || []).map((item: any) => item.judge_id);
    setSelectedJudgeIds(ids);
  }

  function toggleJudge(judgeId: string) {
    setSelectedJudgeIds((prev) => {
      if (prev.includes(judgeId)) {
        return prev.filter((id) => id !== judgeId);
      }
      return [...prev, judgeId];
    });
  }

  async function saveAssignments() {
    if (!segmentId) {
      setMessage("Vui lòng chọn vòng/chặng thi");
      return;
    }

    const res = await fetch("/api/admin/segment-judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segmentId,
        judgeIds: selectedJudgeIds,
        replace: true,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error || "Không lưu được phân công");
      return;
    }

    setMessage("Đã lưu phân công giám khảo");
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Phân công giám khảo</h1>
      <p className="mt-2 text-sm text-slate-600">
        Chọn vòng/chặng thi, sau đó tick các giám khảo được phép chấm vòng/chặng đó.
      </p>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium">Vòng/chặng thi</label>
        <select
          className="mt-2 w-full rounded-lg border p-2"
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
        >
          <option value="">-- Chọn vòng/chặng --</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.stage_name ? ` - ${s.stage_name}` : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Danh sách giám khảo</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {judges.map((judge) => (
            <label
              key={judge.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selectedJudgeIds.includes(judge.id)}
                onChange={() => toggleJudge(judge.id)}
              />
              <span>
                <span className="block font-medium">{judge.full_name}</span>
                <span className="block text-xs text-slate-500">{judge.email}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          className="mt-6 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white"
          onClick={saveAssignments}
        >
          Lưu phân công
        </button>

        {message && <p className="mt-3 text-sm">{message}</p>}
      </section>
    </main>
  );
}
