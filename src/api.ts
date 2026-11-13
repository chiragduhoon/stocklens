export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg =
        typeof body.detail === "string"
          ? body.detail
          : "Please check the entered values.";
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
export const money = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n);
export const compact = (n: number) =>
  Math.abs(n) >= 100000
    ? `₹${(n / 100000).toFixed(2)}L`
    : Math.abs(n) >= 1000
      ? `₹${(n / 1000).toFixed(1)}k`
      : money(n);
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export const dateLabel = (s: string) =>
  new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
