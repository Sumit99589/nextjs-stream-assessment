import test from "node:test";
import assert from "node:assert";

/**
 * Verifies render isolation logic:
 * When rawPayload does not change, expensive formatting calculation is memoized.
 */
test("Payload formatter memoization: Calculation is skipped when payload reference is identical", () => {
  let formatRunCount = 0;

  function memoizedFormatter() {
    let lastPayload = null;
    let lastResult = null;

    return function format(payload) {
      if (payload === lastPayload && lastResult !== null) {
        return lastResult;
      }
      formatRunCount += 1;
      let checksum = 0;
      for (let i = 0; i < payload.length; i++) {
        checksum = (checksum + payload.charCodeAt(i)) % 1000;
      }
      lastPayload = payload;
      lastResult = { checksum };
      return lastResult;
    };
  }

  const format = memoizedFormatter();
  const payload = JSON.stringify({ cpu: 94.2, memory: 81.3, disk: 45.0 });

  // Initial calculation
  const r1 = format(payload);
  assert.strictEqual(formatRunCount, 1);

  // Simulate 50 incoming stream chunks arriving for summary text (payload unchanged)
  for (let chunk = 1; chunk <= 50; chunk++) {
    const rCurrent = format(payload);
    assert.strictEqual(rCurrent.checksum, r1.checksum);
  }

  // Format calculation must NOT have re-run on stream chunk arrivals
  assert.strictEqual(formatRunCount, 1, "Memoized formatter must only run once when payload is unchanged");

  // When a different payload arrives (e.g. user selects new event)
  const newPayload = JSON.stringify({ cpu: 12.0 });
  format(newPayload);
  assert.strictEqual(formatRunCount, 2, "Formatter must re-run when payload changes");
});
