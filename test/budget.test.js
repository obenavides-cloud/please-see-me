import test from "node:test";
import assert from "node:assert/strict";
import { getBudget, getSessionCost, getStopAt } from "../server/budget.js";

test("budget accounts previous recorded usage", () => {
  assert.deepEqual(getBudget(6, [{ costUsd: 1.25 }, { costUsd: 0.75 }]), {
    maxBudgetUsd: 6,
    spentUsd: 2,
    remainingUsd: 4
  });
  assert.equal(getBudget(20, []).maxBudgetUsd, 6);
});

test("auto-stop reserves two minutes and estimated session cost uses elapsed time", () => {
  const start = "2026-01-01T00:00:00.000Z";
  assert.equal(getStopAt(start, 6, 0.71), "2026-01-01T08:25:02.535Z");
  assert.deepEqual(
    getSessionCost({ startedAt: start, hourlyRateUsd: 0.71 }, new Date("2026-01-01T01:00:00.000Z")),
    { seconds: 3600, costUsd: 0.71 }
  );
  assert.throws(() => getStopAt(start, 0.01, 0.71), /safety margin/);
});
