'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { StatusBadge } from '@/components/ui/status-badge';

type Judge = {
  id: string;
  full_name: string;
};

type AssignmentRow = {
  contestant_id: string;
  judge_id: string;
  can_edit: boolean;
};

type ScoreSheetRow = {
  status: 'draft' | 'submitted';
  total_score: number;
};

type ContestantBase = {
  id: string;
  sbd: string;
  full_name: string;
  video_path: string | null;
  score_sheets: ScoreSheetRow[];
};

type Contestant = ContestantBase & {
  assignments: { judge_id: string; can_edit: boolean }[];
};

export function AssignmentManager() {
  const supabase = createClient();

  const [judges, setJudges] = useState<Judge[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<Record<string, string>>(
    {}
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reloadContestants() {
    const [
      { data: contestantsData, error: contestantsError },
      { data: assignmentsData, error: assignmentsError },
    ] = await Promise.all([
      supabase
        .from('contestants')
        .select('id, sbd, full_name, video_path, score_sheets(status, total_score)')
        .order('sbd'),
      supabase
        .from('assignments')
        .select('contestant_id, judge_id, can_edit'),
    ]);

    if (contestantsError) {
      console.error('contestantsError:', contestantsError);
      return;
    }

    if (assignmentsError) {
      console.error('assignmentsError:', assignmentsError);
      return;
    }

    const contestantRows = (contestantsData ?? []) as ContestantBase[];
    const assignmentRows = (assignmentsData ?? []) as AssignmentRow[];

    const assignmentMap = new Map<string, AssignmentRow>();
    for (const row of assignmentRows) {
      // nếu có nhiều dòng cho cùng 1 thí sinh thì lấy dòng cuối cùng đọc được
      assignmentMap.set(row.contestant_id, row);
    }

    const mergedContestants: Contestant[] = contestantRows.map((contestant) => {
      const assignment = assignmentMap.get(contestant.id);

      return {
        ...contestant,
        assignments: assignment
          ? [
              {
                judge_id: assignment.judge_id,
                can_edit: assignment.can_edit,
              },
            ]
          : [],
      };
    });

    setContestants(mergedContestants);

    const nextSelected: Record<string, string> = {};
    for (const contestant of mergedContestants) {
      nextSelected[contestant.id] = contestant.assignments?.[0]?.judge_id ?? '';
    }
    setSelectedJudges(nextSelected);
  }

  useEffect(() => {
    async function load() {
      const { data: judgesData, error: judgesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'judge')
        .order('full_name');

      if (judgesError) {
        console.error('judgesError:', judgesError);
      }

      setJudges((judgesData ?? []) as Judge[]);
      await reloadContestants();
    }

    load();
  }, []);

  async function updateAssignment(contestantId: string, judgeId: string) {
    const oldJudgeId = selectedJudges[contestantId] ?? '';

    // cập nhật giao diện ngay
    setSelectedJudges((prev) => ({
      ...prev,
      [contestantId]: judgeId,
    }));

    setContestants((prev) =>
      prev.map((contestant) => {
        if (contestant.id !== contestantId) return contestant;

        const currentCanEdit = contestant.assignments?.[0]?.can_edit ?? false;

        return {
          ...contestant,
          assignments: judgeId
            ? [{ judge_id: judgeId, can_edit: currentCanEdit }]
            : [],
        };
      })
    );

    setSavingId(contestantId);

    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestantId, judgeId }),
      });

      if (!res.ok) {
        throw new Error('Không cập nhật được phân công.');
      }

      // không reload ngay để tránh bị ghi đè dropdown
      // nếu muốn, anh/chị có thể bấm F5 để kiểm tra dữ liệu DB sau
    } catch (error) {
      console.error('updateAssignment error:', error);

      // rollback nếu lỗi
      setSelectedJudges((prev) => ({
        ...prev,
        [contestantId]: oldJudgeId,
      }));

      setContestants((prev) =>
        prev.map((contestant) => {
          if (contestant.id !== contestantId) return contestant;

          const currentCanEdit = contestant.assignments?.[0]?.can_edit ?? false;

          return {
            ...contestant,
            assignments: oldJudgeId
              ? [{ judge_id: oldJudgeId, can_edit: currentCanEdit }]
              : [],
          };
        })
      );

      alert('Không cập nhật được phân công.');
    } finally {
      setSavingId(null);
    }
  }

  async function reopenScore(contestantId: string) {
    setSavingId(contestantId);

    try {
      const res = await fetch('/api/admin/assignments/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestantId }),
      });

      if (!res.ok) {
        throw new Error('Không mở lại được phiếu chấm.');
      }

      await reloadContestants();
    } catch (error) {
      console.error('reopenScore error:', error);
      alert('Không mở lại được phiếu chấm.');
    } finally {
      setSavingId(null);
    }
  }

  const filteredContestants = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return contestants;

    return contestants.filter((contestant) => {
      const currentJudgeId = selectedJudges[contestant.id] ?? '';
      const judgeName =
        judges.find((judge) => judge.id === currentJudgeId)?.full_name ?? '';

      return [contestant.sbd, contestant.full_name, judgeName].some((value) =>
        value.toLowerCase().includes(keyword)
      );
    });
  }, [contestants, judges, query, selectedJudges]);

  const assignedCount = contestants.filter(
    (contestant) => (selectedJudges[contestant.id] ?? '').trim() !== ''
  ).length;

  const uploadedVideoCount = contestants.filter(
    (contestant) => contestant.video_path
  ).length;

  const submittedCount = contestants.filter(
    (contestant) => contestant.score_sheets?.[0]?.status === 'submitted'
  ).length;

  return (
    <div className="stack-lg">
      <section className="stats-grid">
        <div className="stat-card compact">
          <div className="stat-label">Đã phân công</div>
          <div className="stat-value">
            {assignedCount}/{contestants.length}
          </div>
          <div className="stat-hint">
            Số thí sinh đã có giám khảo phụ trách.
          </div>
        </div>

        <div className="stat-card compact">
          <div className="stat-label">Đã có video</div>
          <div className="stat-value">{uploadedVideoCount}</div>
          <div className="stat-hint">
            Kiểm tra nhanh tiến độ upload video trước khi chấm.
          </div>
        </div>

        <div className="stat-card compact">
          <div className="stat-label">Phiếu đã nộp</div>
          <div className="stat-value">{submittedCount}</div>
          <div className="stat-hint">
            Admin có thể mở lại các phiếu đã khóa nếu cần.
          </div>
        </div>
      </section>

      <section className="card-surface">
        <div className="card-header split-header">
          <div>
            <h3 className="card-title">Bảng phân công giám khảo</h3>
            <p className="card-subtitle">
              Tìm theo SBD, tên thí sinh hoặc tên giám khảo. Thay đổi sẽ được lưu ngay sau khi chọn.
            </p>
          </div>

          <div className="search-box">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              placeholder="Tìm SBD, tên thí sinh, giám khảo..."
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SBD</th>
                <th>Thí sinh</th>
                <th>Video</th>
                <th>Giám khảo phụ trách</th>
                <th>Phiếu chấm</th>
              </tr>
            </thead>

            <tbody>
              {filteredContestants.map((contestant) => {
                const currentJudge = selectedJudges[contestant.id] ?? '';
                const assignment = contestant.assignments?.[0];
                const sheet = contestant.score_sheets?.[0];

                return (
                  <tr key={contestant.id}>
                    <td className="strong-cell">{contestant.sbd}</td>
                    <td>{contestant.full_name}</td>

                    <td>
                      <StatusBadge tone={contestant.video_path ? 'success' : 'danger'}>
                        {contestant.video_path ? 'Đã upload' : 'Chưa có video'}
                      </StatusBadge>
                    </td>

                    <td>
                      <select
                        value={currentJudge}
                        onChange={(e) =>
                          updateAssignment(contestant.id, e.target.value)
                        }
                        disabled={savingId === contestant.id}
                        className="select"
                      >
                        <option value="">-- Chọn giám khảo --</option>
                        {judges.map((judge) => (
                          <option key={judge.id} value={judge.id}>
                            {judge.full_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className="row-actions">
                        <StatusBadge
                          tone={
                            sheet?.status === 'submitted'
                              ? assignment?.can_edit
                                ? 'warning'
                                : 'success'
                              : 'neutral'
                          }
                        >
                          {sheet?.status === 'submitted'
                            ? assignment?.can_edit
                              ? 'Đã nộp - đang mở lại'
                              : 'Đã nộp - đang khóa'
                            : 'Chưa nộp'}
                        </StatusBadge>

                        {sheet?.status === 'submitted' && !assignment?.can_edit ? (
                          <button
                            onClick={() => reopenScore(contestant.id)}
                            disabled={savingId === contestant.id}
                            className="btn btn-secondary btn-sm"
                          >
                            Mở lại
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
