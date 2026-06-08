export type Currency = "USD" | "KHR";

export function formatPrice(amount: number | null | undefined, currency: Currency | string | null | undefined): string {
  if (amount == null) return "";
  const cur: Currency = currency === "KHR" ? "KHR" : "USD";
  const n = Number(amount);
  if (cur === "KHR") {
    return `៛${Math.round(n).toLocaleString("en-US")}`;
  }
  return `$${n.toFixed(2)}`;
}
