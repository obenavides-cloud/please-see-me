import { ABSOLUTE_MAX_BUDGET_USD } from "./budget.js";

export function publicConfig() {
  const configuredBudgetUsd = Number(process.env.RUNPOD_MAX_BUDGET_USD || ABSOLUTE_MAX_BUDGET_USD);
  return {
    runpodConfigured: Boolean(process.env.RUNPOD_API_KEY),
    podConfigured: Boolean(process.env.RUNPOD_POD_ID),
    billingApproved: process.env.RUNPOD_BILLING_APPROVED === "true",
    comfyConfigured: Boolean(process.env.COMFYUI_URL),
    gpuRateUsd: Number(process.env.RUNPOD_GPU_RATE_USD || 0),
    maxBudgetUsd: Number.isFinite(configuredBudgetUsd) && configuredBudgetUsd > 0
      ? Math.min(configuredBudgetUsd, ABSOLUTE_MAX_BUDGET_USD)
      : ABSOLUTE_MAX_BUDGET_USD
  };
}
