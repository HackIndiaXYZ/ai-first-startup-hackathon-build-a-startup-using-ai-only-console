type BudgetStore = {
  prepare(sql: string): {
    bind(...values: (string | number)[]): {
      first<T>(): Promise<T | null>;
    };
  };
};

export function dailyRequestLimit(value?: string): number {
  if (!value?.trim()) return 30;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 0 && limit <= 500 ? limit : 30;
}

export async function reserveAIRequest(
  db: BudgetStore,
  limit: number,
  now = new Date(),
): Promise<boolean> {
  if (limit <= 0) return false;
  // One atomic statement shares the allowance across every visitor and Worker.
  const row = await db
    .prepare(
      "INSERT INTO ai_request_usage (day, requests) VALUES (?, 1) " +
        "ON CONFLICT(day) DO UPDATE SET requests = requests + 1 " +
        "WHERE requests < ? RETURNING requests",
    )
    .bind(now.toISOString().slice(0, 10), limit)
    .first<{ requests: number }>();
  return !!row;
}
