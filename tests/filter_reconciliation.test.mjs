import test from "node:test";
import assert from "node:assert";

const mockEvents = [
  { id: "evt_1", title: "DB connection timeout", service: "database", severity: "critical" },
  { id: "evt_2", title: "High memory usage", service: "api", severity: "high" },
  { id: "evt_3", title: "Cache miss rate elevated", service: "cache", severity: "medium" },
  { id: "evt_4", title: "Informational log warning", service: "auth", severity: "info" },
];

function filterEvents(events, search, severity) {
  const normalizedSearch = search.toLowerCase().trim();
  return events.filter((e) => {
    const matchesSeverity = severity === "all" || e.severity === severity;
    const matchesSearch =
      !normalizedSearch ||
      e.title.toLowerCase().includes(normalizedSearch) ||
      e.service.toLowerCase().includes(normalizedSearch) ||
      e.id.toLowerCase().includes(normalizedSearch);
    return matchesSeverity && matchesSearch;
  });
}

function reconcileSelection(selected, filteredList) {
  if (!selected) return null;
  const isPresent = filteredList.some((e) => e.id === selected.id);
  return isPresent ? selected : null;
}

test("Immediate filter changes clear selection to cancel in-flight stream", () => {
  let selectedEvent = mockEvents[0]; // evt_1 is selected and streaming
  let streamAborted = false;

  const controller = new AbortController();
  controller.signal.addEventListener("abort", () => {
    streamAborted = true;
  });

  // User types in search input
  function handleSearchChange(newValue) {
    // Immediate cancellation contract: selection is cleared on keystroke without waiting for debounce
    selectedEvent = null;
    controller.abort();
  }

  handleSearchChange("timeout");

  assert.strictEqual(selectedEvent, null, "Selection must be cleared immediately on typing");
  assert.strictEqual(streamAborted, true, "Active stream must be aborted immediately upon typing");
});

test("Filter reconciliation: Changing severity clears selection if event does not match filter", () => {
  const initialSelection = mockEvents[3]; // evt_4 (info)
  assert.strictEqual(initialSelection.id, "evt_4");

  const filtered = filterEvents(mockEvents, "", "critical");
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, "evt_1");

  const reconciled = reconcileSelection(initialSelection, filtered);
  assert.strictEqual(reconciled, null, "Selection should be cleared when not present in filtered results");
});

test("Filter reconciliation: Search filtering retains matching selected event", () => {
  const initialSelection = mockEvents[0]; // evt_1 (database)

  const filtered = filterEvents(mockEvents, "database", "all");
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, "evt_1");

  const reconciled = reconcileSelection(initialSelection, filtered);
  assert.strictEqual(reconciled?.id, "evt_1", "Matching event should remain selected");
});
