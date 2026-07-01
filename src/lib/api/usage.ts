export interface UsageInfo {
  isAnonymous: boolean;
  count: number;
  limit: number;
  remaining: number;
}

export const usageKeys = {
  all: ["usage"] as const,
  detail: () => [...usageKeys.all, "detail"] as const,
};

export async function fetchUsage(): Promise<UsageInfo> {
  const res = await fetch("/api/usage");
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}
