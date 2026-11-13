// Whether the app is showing the offline demo dataset or real market data, and its as-of date.
// Set once from /api/bootstrap; every disclosure label reads it so wording always matches the data.
let simulated = true;
let asOf = "";

export function setDataMode(isSimulated: boolean | undefined, date: string | null | undefined) {
  simulated = isSimulated ?? true;
  asOf = date ?? "";
}

export const isSimulated = () => simulated;

export function asOfLabel(): string {
  if (!asOf) return "";
  const d = new Date(asOf);
  return Number.isNaN(d.getTime()) ? asOf : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
