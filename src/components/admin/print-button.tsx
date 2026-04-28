'use client';

type Props = {
  label?: string;
};

export function PrintButton({ label = 'In / Lưu PDF' }: Props) {
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
