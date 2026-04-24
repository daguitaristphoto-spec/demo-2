import { ROUND1_CRITERIA } from './round1-criteria';
import type { ScoreItemInput } from './types';

export function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateRound1Score(items: ScoreItemInput[]) {
  const groupScores = ROUND1_CRITERIA.map((group) => {
    const raw = group.items.reduce((sum, item) => {
      const found = items.find((x) => x.criterionKey === item.key);
      return sum + clampScore(Number(found?.score ?? 0), 0, item.max);
    }, 0);

    const maxRaw = group.items.reduce((sum, item) => sum + item.max, 0);
    const normalized10 = maxRaw === 0 ? 0 : (raw / maxRaw) * 10;

    return {
      key: group.key,
      title: group.title,
      weight: group.weight,
      raw,
      maxRaw,
      normalized10,
      weighted100: normalized10 * group.weight * 10,
    };
  });

  const final100 = Number(
    groupScores.reduce((sum, group) => sum + group.weighted100, 0).toFixed(2)
  );

  return {
    groupScores,
    final100,
    classification:
      final100 >= 85 ? 'Xuất sắc' : final100 >= 70 ? 'Tiềm năng' : 'Chưa đạt',
  };
}
