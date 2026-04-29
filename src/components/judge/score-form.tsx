'use client';

import { useMemo, useState } from 'react';
import { ROUND1_CRITERIA } from '@/lib/round1-criteria';
import { calculateRound1Score } from '@/lib/scoring';
import type { ScoreItemInput } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';

type ExistingItem = {
  criterion_key: string;
  criterion_group: string;
  score: number;
};

type Props = {
  contestantId: string;
  canEdit: boolean;
  strengths?: string | null;
  weaknesses?: string | null;
  items?: ExistingItem[];
};

export function ScoreForm({ contestantId, canEdit, items = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const item of items) {
      seed[item.criterion_key] = Number(item.score);
    }
    return seed;
  });

  const scoreItems: ScoreItemInput[] = useMemo(
    () =>
      ROUND1_CRITERIA.flatMap((group) =>
        group.items.map((item) => ({
          criterionKey: item.key,
          criterionGroup: group.key,
          score: Number(values[item.key] ?? 0),
        }))
      ),
    [values]
  );

  const scoreResult = calculateRound1Score(scoreItems);

  function updateScore(criterionKey: string, rawValue: string, maxScore: number) {
    const normalizedValue = rawValue.replace(',', '.').replace(/[^0-9.]/g, '');

    if (normalizedValue === '') {
      setValues((prev) => {
        const next = { ...prev };
        delete next[criterionKey];
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

    const clampedValue = Math.min(Math.max(numericValue, 0), maxScore);

    setValues((prev) => ({
      ...prev,
      [criterionKey]: clampedValue,
    }));
  }

  async function persist(action: 'save' | 'submit') {
    setLoading(true);
    setMessage(null);

    const res = await fetch('/api/judge/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contestantId,
        action,
        items: scoreItems,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error ?? 'Không lưu được phiếu chấm.');
      setLoading(false);
      return;
    }

    setMessage(action === 'submit' ? 'Đã nộp phiếu chấm.' : 'Đã lưu nháp.');
    setLoading(false);
    if (action === 'submit') {
      window.location.reload();
    }
  }

  return (
    <div className="card-surface score-card">
      <div className="score-card-top">
        <div>
          <div className="eyebrow">Speak Up DNU 2026</div>
          <h2 className="card-title">Phiếu chấm vòng 1</h2>
          <p className="card-subtitle">
            Điểm được quy đổi tự động theo trọng số 100 điểm, giữ đúng cấu trúc bảng chấm vòng sơ loại.
          </p>
        </div>
        <div className="score-summary-box">
          <div className="score-summary-label">Tổng điểm</div>
          <div className="score-summary-value">{scoreResult.final100}</div>
          <div className="score-summary-footer">
            <StatusBadge tone={scoreResult.final100 >= 85 ? 'success' : scoreResult.final100 >= 70 ? 'warning' : 'danger'}>
              {scoreResult.classification}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="criteria-stack">
        {ROUND1_CRITERIA.map((group) => (
          <section key={group.key} className="criteria-card">
            <div className="criteria-header">
              <div>
                <h3>{group.title}</h3>
                <p>Trọng số {group.weight * 100}%</p>
              </div>
            </div>

            <div className="criteria-items">
              {group.items.map((item) => (
                <div key={item.key} className="criterion-row">
                  <label className="criterion-label">{item.label}</label>
                  <div className="criterion-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!canEdit || loading}
                      value={values[item.key] ?? ''}
                      onChange={(e) => updateScore(item.key, e.target.value, Number(item.max))}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="input score-input"
                    />
                    <span className="criterion-max">/ {item.max}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {message ? <div className="alert alert-info">{message}</div> : null}

      <div className="score-actions">
        <button onClick={() => persist('save')} disabled={!canEdit || loading} className="btn btn-secondary">
          Lưu nháp
        </button>
        <button onClick={() => persist('submit')} disabled={!canEdit || loading} className="btn btn-primary">
          Nộp chính thức
        </button>
        {!canEdit ? <span className="lock-note">Phiếu đã khóa. Chỉ admin mới có thể mở lại.</span> : null}
      </div>
    </div>
  );
}
