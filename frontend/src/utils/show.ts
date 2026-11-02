export type ShowRules = {
  duration: string;
  increment: string;
  shipping: string;
  date: string;
  time: string;
};
export function validateShowStep(step: number, v: ShowRules): string | null {
  if (
    step === 2 &&
    (!Number.isFinite(Number(v.duration)) ||
      Number(v.duration) < 5 ||
      !Number.isFinite(Number(v.increment)) ||
      Number(v.increment) <= 0)
  )
    return "Use an auction duration of at least 5 seconds and a positive bid increment.";
  if (
    step === 3 &&
    (!Number.isFinite(Number(v.shipping)) || Number(v.shipping) < 0)
  )
    return "Shipping must be zero or a positive amount.";
  if (step === 4) {
    const parsed = new Date(v.date + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== v.date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)
    )
      return "Enter a valid date and 24-hour time.";
  }
  return null;
}
