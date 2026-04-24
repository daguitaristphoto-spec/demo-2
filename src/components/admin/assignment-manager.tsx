'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { StatusBadge } from '@/components/ui/status-badge';

type Judge = { id: string; full_name: string };
type Contestant = {
  id: string;
  sbd: string;
  full_name: string;
  video_path: string | null;
  assignments: { judge_id: string; can_edit: boolean }[];
  score_sheets: { status: 'draft' | 'submitted'; total_score: number }[];
};

export function AssignmentManager() {
  const supabase = createClient();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reloadContestants() {
    const { data: contestantsData } = await supabase
      .from('contestants')
      .select('id, sbd, full_name, video_path, assignments(judge_id, can_edit), score_sheets(status, total_score)')
      .order('sbd');

    setContestants((contestantsData ?? []) as Contestant[]);
  }

  useEffect(() => {
    async function load() {
      const { data: judgesData } = await supabase.from('profiles').select('id, full_name').eq('role', 'judge').order('full_name');
      setJudges((judgesData ?? []) as Judge[]);
      await reloadContestants();
    }

    load();
  }, []);

  async function updateAssignment(contestantId: string, judgeId: string) {
    setSavingId(contestantId);

    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestantId, judgeId }),
    });

    if (!res.ok) {
      alert('Không cập nhật được phân công.');
      setSavingId(null);
      return;
    }

    await reloadContestants();
    setSavingId(null);
  }

  async function reopenScore(contestantId: string) {
    setSavingId(contestantId);
    const res = await fetch('/api/admin/assignments/reopen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestantId }),
    });

    if (!res.ok) {
      alert('Không mở lại được phiếu chấm.');
      setSavingId(null);
      return;
    }

    await reloadContestants();
    setSavingId(null);
  }

  const filteredContestants = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return contestants;

    return contestants.filter((contestant) => {
      const currentJudgeId = contestant.assignments?.[0]?.judge_id ?? '';
      const judgeName = judges.find((judge) => judge.id === currentJudgeId)?.full_name ?? '';
      return [contestant.sbd, contestant.full_name, judgeName].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [contestants, judges, query]);

  const assignedCount = contestants.filter((contestant) => contestant.assignments?.[0]?.judge_id).length;
  const uploadedVideoCount = contestants.filter((contestant) => contestant.video_path).length;
  const submittedCount = contestants.filter((contestant) => contestant.score_sheets?.[0]?.status === 'submitted').length;

  return (
    <div className="stack-lg">
      <section className="stats-grid">
        <div className="stat-card compact">
          <div className="stat-label">Đã phân công</div>
          <div className="stat-value">{assignedCount}/{contestants.length}</div>
          <div className="stat-hint">Số thí sinh đã có giám khảo phụ trách.</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Đã có video</div>
          <div className="stat-value">{uploadedVideoCount}</div>
          <div className="stat-hint">Kiểm tra nhanh tiến độ upload video trước khi chấm.</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Phiếu đã nộp</div>
          <div className="stat-value">{submittedCount}</div>
          <div className="stat-hint">Admin có thể mở lại các phiếu đã khóa nếu cần.</div>
        </div>
      </section>

      <section className="card-surface">
        <div className="card-header split-header">
          <div>
            <h3 className="card-title">Bảng phân công giám khảo</h3>
            <p className="card-subtitle">Tìm theo SBD, tên thí sinh hoặc tên giám khảo. Thay đổi sẽ được lưu ngay sau khi chọn.</p>
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
                const currentJudge = contestant.assignments?.[0]?.judge_id ?? '';
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
                        onChange={(e) => updateAssignment(contestant.id, e.target.value)}
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
                          tone={sheet?.status === 'submitted' ? (assignment?.can_edit ? 'warning' : 'success') : 'neutral'}
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
