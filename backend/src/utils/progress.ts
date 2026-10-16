/** Completion percentage, rounded to a whole number. A project with no tasks is 0%. */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
