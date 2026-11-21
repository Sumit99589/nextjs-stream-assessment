import test from "node:test";
import assert from "node:assert";

/**
 * Unit test for stream cancellation and race condition handling.
 * Verifies that switching events aborts the in-flight stream and prevents chunk cross-contamination.
 */
test("Stream cancellation: switching Event A -> Event B aborts Event A immediately", async () => {
  const eventsReceived = {
    evt_A: [],
    evt_B: [],
  };

  let activeController = null;
  let activeEventId = null;

  async function startStream(eventId) {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;
    activeEventId = eventId;

    try {
      for (let i = 1; i <= 5; i++) {
        if (controller.signal.aborted || activeEventId !== eventId) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));

        if (controller.signal.aborted || activeEventId !== eventId) {
          break;
        }

        eventsReceived[eventId].push(`chunk_${i}`);
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        // Ignored as expected
      }
    }
  }

  // 1. Start stream for evt_A
  const streamA = startStream("evt_A");
  await new Promise((r) => setTimeout(r, 30)); // allow chunk 1 to land

  // 2. Rapidly switch to evt_B before evt_A finishes
  const streamB = startStream("evt_B");
  await Promise.all([streamA, streamB]);

  // evt_A should be aborted early (not all 5 chunks)
  assert.ok(eventsReceived.evt_A.length < 5, "Event A should have aborted early");
  // evt_B should complete all 5 chunks
  assert.strictEqual(eventsReceived.evt_B.length, 5, "Event B should complete all chunks");
});

test("Rapid switching A -> B -> A leaves only the latest stream active", async () => {
  const renderedText = {};
  let activeController = null;
  let activeEventId = null;

  async function selectEvent(eventId) {
    if (activeController) {
      activeController.abort();
    }
    const controller = new AbortController();
    activeController = controller;
    activeEventId = eventId;
    renderedText[eventId] = "";

    try {
      for (let i = 0; i < 3; i++) {
        if (controller.signal.aborted || activeEventId !== eventId) return;
        await new Promise((r) => setTimeout(r, 15));
        if (controller.signal.aborted || activeEventId !== eventId) return;
        renderedText[eventId] += `[${eventId}_tok${i}]`;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  // Rapidly toggle A -> B -> A
  selectEvent("evt_A");
  await new Promise((r) => setTimeout(r, 10));
  selectEvent("evt_B");
  await new Promise((r) => setTimeout(r, 10));
  const finalStream = selectEvent("evt_A");

  await finalStream;
  await new Promise((r) => setTimeout(r, 80));

  // evt_B should have been cancelled before completion
  assert.ok(renderedText.evt_B.length < "[evt_B_tok0][evt_B_tok1][evt_B_tok2]".length);
  // Final evt_A must have completed cleanly
  assert.strictEqual(renderedText.evt_A, "[evt_A_tok0][evt_A_tok1][evt_A_tok2]");
});
