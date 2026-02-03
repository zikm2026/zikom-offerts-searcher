const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const VALID_GRADES = new Set(GRADE_ORDER);

export function gradeToNumber(grade: string | null | undefined): number | null {
  if (!grade || !grade.trim()) return null;
  const letter = grade.trim().toUpperCase().charAt(0);
  if (!VALID_GRADES.has(letter as (typeof GRADE_ORDER)[number])) return null;
  return GRADE_ORDER.indexOf(letter as (typeof GRADE_ORDER)[number]) + 1;
}

export function parseGradeFromOffer(gradeText: string | null | undefined): string | null {
  if (!gradeText || !gradeText.trim()) return null;
  const upper = gradeText.toUpperCase().trim();
  for (const g of GRADE_ORDER) {
    if (upper.includes(g)) return g;
  }
  return null;
}

export function isGradeInRange(
  offerGradeText: string | null | undefined,
  gradeFrom: string | null | undefined,
  gradeTo: string | null | undefined
): boolean {
  const fromNum = gradeToNumber(gradeFrom ?? null);
  const toNum = gradeToNumber(gradeTo ?? null);
  if (fromNum === null && toNum === null) return true;

  const offerLetter = parseGradeFromOffer(offerGradeText);
  const offerNum = gradeToNumber(offerLetter ?? null);
  if (offerNum === null) return false;

  const minGrade = fromNum !== null && toNum !== null ? Math.min(fromNum, toNum) : (toNum ?? fromNum);
  const maxGrade = fromNum !== null && toNum !== null ? Math.max(fromNum, toNum) : (fromNum ?? toNum);
  if (minGrade === null || maxGrade === null) return true;
  return offerNum >= minGrade && offerNum <= maxGrade;
}
