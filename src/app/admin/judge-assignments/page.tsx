"use client";

import { useEffect, useState } from "react";

type Judge = {
  id: string;
  full_name: string;
  email?: string | null;
  role: string;
};

type AssignedJudge = {
  judge_id: string;
};

const ASSIGNMENT_SEGMENTS = [
  {
    id: "round1_online",
    label: "Vòng 1: Chấm online",
    realSegmentIds: ["round1_online"],
  },
  {
    id: "round2_semifinal",
    label: "Vòng 2: Bán kết - Vượt ải",
    realSegmentIds: ["round2_semifinal"],
  },
  {
    id: "round3_final",
    label: "Vòng 3: Chung kết",
    realSegmentIds: ["round3_stage1", "round3_stage2", "round3_stage3"],
  },
];

export default function JudgeAssignmentsPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadJudges();
  }, []);

  useEffect(() => {
    if (segmentId) {
      loadAssignedJudges(segmentId);
    } else {
      setSelectedJudgeIds([]);
    }
  }, [segmentId]);

  async function loadJudges() {
    setLoading(true);
    setMessage("");

    try {
      const judgesRes = await fetch("/api/admin/judges");
      const judgesJson = await judgesRes.json();

      if (!judgesRes.ok) {
        setMessage(judgesJson.error || "Không tải được danh sách giám khảo");
        return;
      }

      setJudges(judgesJson.judges || []);
    } catch {
      setMessage("Có lỗi khi tải danh sách giám khảo");
    } finally {
      setLoading(false);
    }
  }

  function getSelectedAssignmentSegment() {
    return ASSIGNMENT_SEGMENTS.find((item) => item.id === segmentId);
  }

  async function loadAssignedJudges(nextSegmentId: string) {
    setLoading(true);
    setMessage("");

    try {
      const assignmentSegment = ASSIGNMENT_SEGMENTS.find((item) => item.id === nextSegmentId);

      if (!assignmentSegment) {
        setSelectedJudgeIds([]);
        return;
      }

      // Với vòng 3, chỉ cần đọc phân công từ chặng 1.
      // Khi lưu, hệ thống sẽ đồng bộ cùng danh sách giám khảo cho cả 3 chặng.
      const segmentToRead = assignmentSegment.realSegmentIds[0];

      const res = await fetch(`/api/admin/segment-judges?segmentId=${segmentToRead}`);
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || "Không tải được phân công giám khảo");
        return;
      }

      const ids = (json.judges || []).map((item: AssignedJudge) => item.judge_id);
      setSelectedJudgeIds(ids);
    } catch {
      setMessage("Có lỗi khi tải phân công giám khảo");
    } finally {
      setLoading(false);
    }
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
      setMessage("Vui lòng chọn vòng thi");
      return;
    }

    const assignmentSegment = getSelectedAssignmentSegment();

    if (!assignmentSegment) {
      setMessage("Vòng thi không hợp lệ");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Nếu chọn Vòng 3, sẽ lưu cùng một danh sách giám khảo cho cả 3 chặng.
      const results = await Promise.all(
        assignmentSegment.realSegmentIds.map((realSegmentId) =>
          fetch("/api/admin/segment-judges", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              segmentId: realSegmentId,
              judgeIds: selectedJudgeIds,
              replace: true,
            }),
          })
        )
      );

      const failed = results.find((res) => !res.ok);

      if (failed) {
        const json = await failed.json();
        setMessage(json.error || "Không lưu được phân công");
        return;
      }

      setMessage("Đã lưu phân công giám khảo");
    } catch {
      setMessage("Có lỗi khi lưu phân công");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Phân công giám khảo theo vòng</h1>
        <p className="mt-2 text-sm text-slate-600">
          Chọn vòng thi, sau đó tick các giám khảo được phép chấm vòng đó.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium">Vòng thi</label>

        <select
          className="mt-2 w-full rounded-lg border p-2"
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
        >
          <option value="">-- Chọn vòng thi --</option>

          {ASSIGNMENT_SEGMENTS.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.label}
            </option>
          ))}
        </select>

        {segmentId === "round3_final" && (
          <p className="mt-2 text-sm text-slate-500">
            Giám khảo được chọn ở đây sẽ được gán chung cho cả 3 chặng của vòng chung kết.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Danh sách giám khảo</h2>

        {judges.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Chưa có tài khoản giám khảo hoặc chưa tải được danh sách giám khảo.
          </p>
        ) : (
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
        )}

        <button
          className="mt-6 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          onClick={saveAssignments}
          disabled={loading}
        >
          {loading ? "Đang xử lý..." : "Lưu phân công"}
        </button>

        {message && <p className="mt-3 text-sm">{message}</p>}
      </section>
    </main>
  );
}
