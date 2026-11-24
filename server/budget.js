export const ABSOLUTE_MAX_BUDGET_USD = 6;

export function getBudget(maxBudgetUsd, costs) {
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0) {
    throw new Error("RUNPOD_MAX_BUDGET_USD must be greater than zero");
  }
  const enforcedMaxUsd = Math.min(maxBudgetUsd, ABSOLUTE_MAX_BUDGET_USD);
  const spentUsd = costs.reduce((total, entry) => total + Number(entry.costUsd || 0), 0);
  return {
    maxBudgetUsd: enforcedMaxUsd,
    spentUsd,
    remainingUsd: Math.max(0, enforcedMaxUsd - spentUsd)
  };
}

export function getStopAt(startedAt, remainingUsd, hourlyRateUsd, guardSeconds = 120) {
  if (!Number.isFinite(hourlyRateUsd) || hourlyRateUsd <= 0) {
    throw new Error("RUNPOD_GPU_RATE_USD must be greater than zero");
  }
  const remainingSeconds = remainingUsd / hourlyRateUsd * 3600 - guardSeconds;
  if (remainingSeconds <= 0) {
    throw new Error("Remaining budget is insufficient for the auto-stop safety margin");
  }
  return new Date(new Date(startedAt).getTime() + remainingSeconds * 1000).toISOString();
}

export function getSessionCost(session, stoppedAt = new Date()) {
  const seconds = Math.max(0, (new Date(stoppedAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
  return {
    seconds,
    costUsd: seconds / 3600 * session.hourlyRateUsd
  };
}
