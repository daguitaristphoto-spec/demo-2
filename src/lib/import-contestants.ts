export type ContestantImportRow = {
  sbd: string;
  full_name: string;
  profile_text?: string;
  portrait_url?: string;
};

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickValue(row: Record<string, unknown>, acceptedHeaders: string[]) {
  const normalizedMap = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    normalizedMap.set(normalizeHeader(key), value);
  }

  for (const header of acceptedHeaders) {
    if (normalizedMap.has(normalizeHeader(header))) {
      return normalizedMap.get(normalizeHeader(header));
    }
  }

  return undefined;
}

function toOptionalText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  return text ? text : undefined;
}

export function mapExcelRowsToContestants(rows: Record<string, unknown>[]) {
  const contestants: ContestantImportRow[] = [];
  const errors: string[] = [];
  const seenSbd = new Set<string>();

  rows.forEach((row, index) => {
    const lineNo = index + 2;

    const sbd = toOptionalText(pickValue(row, ['sbd', 'so bao danh', 'stt du thi', 'ma thi sinh', 'ma so', 'số báo danh']));
    const fullName = toOptionalText(pickValue(row, ['full_name', 'full name', 'ho va ten', 'họ và tên', 'ho ten', 'họ tên', 'ten thi sinh', 'tên thí sinh']));
    const profileText = toOptionalText(pickValue(row, ['profile_text', 'profile', 'gioi thieu', 'giới thiệu', 'thong tin', 'thông tin']));
    const portraitUrl = toOptionalText(pickValue(row, ['portrait_url', 'portrait', 'anh chan dung', 'ảnh chân dung', 'avatar', 'image', 'image_url']));

    if (!sbd && !fullName && !profileText && !portraitUrl) {
      return;
    }

    if (!sbd) {
      errors.push(`Dòng ${lineNo}: thiếu SBD.`);
      return;
    }

    if (!fullName) {
      errors.push(`Dòng ${lineNo}: thiếu họ tên.`);
      return;
    }

    if (seenSbd.has(sbd)) {
      errors.push(`Dòng ${lineNo}: SBD ${sbd} bị trùng trong file import.`);
      return;
    }

    seenSbd.add(sbd);
    contestants.push({
      sbd,
      full_name: fullName,
      ...(profileText ? { profile_text: profileText } : {}),
      ...(portraitUrl ? { portrait_url: portraitUrl } : {}),
    });
  });

  return { contestants, errors };
}
