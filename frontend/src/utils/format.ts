/**
 * Format amount in cents to USD currency string with thousand separators
 * @param amount Amount in cents (integer)
 * @returns Formatted string like "$350,000.00"
 */
export function formatCurrency(amount: number): string {
  const dollars = amount / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
