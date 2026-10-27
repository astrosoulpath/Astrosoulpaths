type PaymentAmount = { amount?: unknown; currency?: string | null };

// Display aggregation only; never converts currencies or posts financial data.
export function paymentTotals(rows: PaymentAmount[]) {
  const sums = new Map<string, bigint>();
  let unavailable = 0;
  for (const row of rows) {
    const currency = row.currency?.trim().toUpperCase() ?? '';
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(row.amount ?? ''));
    if (!/^[A-Z]{3}$/.test(currency) || !match) { unavailable++; continue; }
    const amount = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'));
    sums.set(currency, (sums.get(currency) ?? BigInt(0)) + amount);
  }
  return { totals: [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({
    currency, amount: `${amount / BigInt(100)}.${String(amount % BigInt(100)).padStart(2, '0')}`,
  })), unavailable };
}
