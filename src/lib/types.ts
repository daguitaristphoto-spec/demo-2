export type AppRole = 'admin' | 'judge';
export type SheetStatus = 'draft' | 'submitted';

export type CriterionDefinition = {
  key: string;
  label: string;
  max: number;
};

export type CriterionGroup = {
  key: string;
  title: string;
  weight: number;
  items: CriterionDefinition[];
};

export type ScoreItemInput = {
  criterionKey: string;
  criterionGroup: string;
  score: number;
};
