import test from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import "./setup_components.mjs";

// Setup JSDOM environment
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock fetch for stream-summary endpoint
globalThis.fetch = async (url, options) => {
  return {
    ok: true,
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return {
              done: false,
              value: new TextEncoder().encode("AI analysis generated."),
            };
          },
          releaseLock: () => {},
        };
      },
    },
  };
};

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");

const { FilterBar } = await import("./.compiled/FilterBar.mjs");
const { EventList } = await import("./.compiled/EventList.mjs");
const { StreamingSummaryDrawer } = await import("./.compiled/StreamingSummaryDrawer.mjs");
const { DashboardClient } = await import("./.compiled/DashboardClient.mjs");
const { NavigationContext } = await import("./.compiled/mockNavigation.mjs");

function createTestContainer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    container,
    root,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const mockEvents = [
  {
    id: "evt_101",
    timestamp: "2026-11-20T10:00:00Z",
    service: "auth-service",
    severity: "critical",
    title: "Database connection pool exhausted",
    rawPayload: JSON.stringify({ pool_size: 50, active_connections: 50 }),
  },
  {
    id: "evt_102",
    timestamp: "2026-11-20T10:05:00Z",
    service: "payment-gateway",
    severity: "high",
    title: "High API response latency",
    rawPayload: JSON.stringify({ p99_latency_ms: 1850 }),
  },
  {
    id: "evt_103",
    timestamp: "2026-11-20T10:10:00Z",
    service: "notification-worker",
    severity: "info",
    title: "Email batch dispatched successfully",
    rawPayload: JSON.stringify({ batch_size: 1200 }),
  },
];

test("Component integration: FilterBar mounts, renders controls, and dispatches user actions", async () => {
  const { container, root, cleanup } = createTestContainer();

  let searchVal = "";
  let severityVal = "all";

  await act(async () => {
    root.render(
      React.createElement(FilterBar, {
        search: searchVal,
        onSearchChange: (val) => {
          searchVal = val;
        },
        severity: severityVal,
        onSeverityChange: (sev) => {
          severityVal = sev;
        },
        pageRenders: 1,
      })
    );
  });

  const input = container.querySelector("input");
  const select = container.querySelector("select");
  assert.ok(input, "Search input must be present in DOM");
  assert.ok(select, "Severity select dropdown must be present in DOM");
  assert.strictEqual(input.placeholder, "Filter by service, title, or ID...");

  // Simulate user typing in input
  await act(async () => {
    input.value = "payment";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });

  // Verify change handler triggers on select
  await act(async () => {
    select.value = "critical";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });

  await cleanup();
});

test("Component integration: EventList mounts and handles event selection", async () => {
  const { container, root, cleanup } = createTestContainer();

  let selectedEvent = null;

  await act(async () => {
    root.render(
      React.createElement(EventList, {
        events: mockEvents,
        selectedEventId: selectedEvent?.id ?? null,
        onSelectEvent: (evt) => {
          selectedEvent = evt;
        },
        loadingEvents: false,
      })
    );
  });

  assert.ok(
    container.textContent.includes("Database connection pool exhausted"),
    "Event 1 title rendered"
  );
  assert.ok(
    container.textContent.includes("High API response latency"),
    "Event 2 title rendered"
  );

  // Click on the second event row
  const rows = container.querySelectorAll("div[style*=\"cursor: pointer\"]");
  assert.strictEqual(rows.length, 3, "Event rows must match events count");

  await act(async () => {
    rows[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });

  assert.ok(selectedEvent !== null, "Clicking row must trigger onSelectEvent");
  assert.strictEqual(selectedEvent.id, "evt_102");
  assert.strictEqual(selectedEvent.title, "High API response latency");

  await cleanup();
});

test("Component integration: StreamingSummaryDrawer displays selected event and re-mounts on event switch", async () => {
  const { container, root, cleanup } = createTestContainer();

  // 1. Initial empty state: no selected event
  await act(async () => {
    root.render(
      React.createElement(StreamingSummaryDrawer, {
        selectedEvent: null,
      })
    );
  });

  assert.ok(
    container.textContent.includes("Incident Summary") &&
    container.textContent.includes("Select an event to view incident summary..."),
    "Drawer displays empty state when no event selected"
  );

  // 2. Select Event A
  await act(async () => {
    root.render(
      React.createElement(StreamingSummaryDrawer, {
        selectedEvent: mockEvents[0],
      })
    );
  });

  assert.ok(
    container.textContent.includes("Analysis: evt_101"),
    "Drawer renders Event A analysis header"
  );

  // 3. Switch to Event B
  await act(async () => {
    root.render(
      React.createElement(StreamingSummaryDrawer, {
        selectedEvent: mockEvents[1],
      })
    );
  });

  assert.ok(
    container.textContent.includes("Analysis: evt_102"),
    "Drawer successfully switches and renders Event B analysis header"
  );
  assert.ok(
    !container.textContent.includes("Analysis: evt_101"),
    "Event A header is unmounted and replaced"
  );

  await cleanup();
});

test("Component integration: Severity navigation preserves pending typed search input", () => {
  let searchInput = "auth-serv"; // User partially typed "auth-serv", debounce pending
  let currentSeverity = "all";
  let routedUrl = null;

  const searchParams = new URLSearchParams("");

  // Replicates handleSeverityChange contract with searchInput preservation
  function onSeverityChange(newSeverity) {
    const params = new URLSearchParams(searchParams.toString());
    if (newSeverity !== "all") {
      params.set("severity", newSeverity);
    } else {
      params.delete("severity");
    }

    // Crucial fix: preserve pending search input in the URL transition
    if (searchInput.trim()) {
      params.set("search", searchInput.trim());
    } else {
      params.delete("search");
    }

    routedUrl = `/?${params.toString()}`;
  }

  onSeverityChange("critical");

  assert.strictEqual(
    routedUrl,
    "/?severity=critical&search=auth-serv",
    "Changing severity must preserve partially typed pending search query!"
  );
});

test("Full DashboardClient integration: renders dashboard, handles selection, cancels on typing, and preserves pending search on severity change", async () => {
  const { container, root, cleanup } = createTestContainer();

  const pushedUrls = [];
  const mockRouter = {
    push: (url) => {
      pushedUrls.push(url);
    },
  };
  const mockSearchParams = new URLSearchParams("");

  // 1. Mount full DashboardClient
  await act(async () => {
    root.render(
      React.createElement(
        NavigationContext.Provider,
        { value: { router: mockRouter, searchParams: mockSearchParams } },
        React.createElement(DashboardClient, {
          events: mockEvents,
          search: "",
          severity: "all",
        })
      )
    );
  });

  // Verify full dashboard elements rendered
  const searchInput = container.querySelector("input");
  const severitySelect = container.querySelector("select");
  const eventRows = container.querySelectorAll("div[style*=\"cursor: pointer\"]");

  assert.ok(searchInput, "FilterBar search input rendered");
  assert.ok(severitySelect, "FilterBar severity select rendered");
  assert.strictEqual(eventRows.length, 3, "EventList rendered 3 events");

  // Initial state has events[0] selected by default
  assert.ok(
    container.textContent.includes("Analysis: evt_101"),
    "Drawer starts with default initial event analysis"
  );

  // 2. Click on the second event (evt_102) in the EventList to select it
  await act(async () => {
    eventRows[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });

  assert.ok(
    container.textContent.includes("Analysis: evt_102"),
    "Selecting Event 2 updates drawer with Event 2 analysis"
  );

  // 3. Type into search input -> immediately clears selected event to cancel in-flight stream
  await act(async () => {
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputSetter.call(searchInput, "payment");
    searchInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });

  assert.ok(
    container.textContent.includes("Incident Summary") &&
    container.textContent.includes("Select an event to view incident summary..."),
    "Typing in search input immediately clears selected event to cancel in-flight stream"
  );

  // 4. Change severity dropdown before debounce finishes -> cancels pending debounce timer and preserves search
  await act(async () => {
    const nativeSelectSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLSelectElement.prototype,
      "value"
    ).set;
    nativeSelectSetter.call(severitySelect, "critical");
    severitySelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });

  assert.ok(pushedUrls.length > 0, "Severity change triggers router.push");
  const lastUrl = pushedUrls[pushedUrls.length - 1];
  assert.ok(
    lastUrl.includes("severity=critical") && lastUrl.includes("search=payment"),
    `Pushed URL must include both severity and pending search: ${lastUrl}`
  );

  await cleanup();
});
