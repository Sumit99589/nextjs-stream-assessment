# Frontend Architecture & Debugging Decisions

Please answer these four questions concisely before submitting your solution.

## 1. Root-Cause Diagnosis
What caused each of the three reported issues in the starter codebase?

- **Stream cross-contamination:** The `reader.read()` stream loop lacked `AbortController` cancellation. Selecting Event B while Event A was streaming left Event A's reader running in memory, appending tokens from Event A into Event B's drawer state.
- **Duplicate fetches & broken history navigation:** Filter state was coupled bidirectionally through `useEffect` hooks. Typing triggered unthrottled `router.push()` calls on every keystroke, flooding browser history and breaking Back/Forward navigation. Listening to `useSearchParams()` inside an effect also triggered redundant API fetches on mount and navigation.
- **Render cascade during streaming:** Streaming token state was held in the top-level dashboard component. Every incoming chunk forced the entire tree to re-render, including the 500-row `EventList` and `HeavyPayloadFormatter`. Because `HeavyPayloadFormatter` runs an artificial 12ms synchronous busy-wait loop per render, streaming 10–20 chunks per second starved the main thread and caused visible UI lag.

## 2. Server vs. Client Component Boundaries
Which parts of the application did you move to Server Components vs. keep as Client Components, and why? What serializable props cross the boundary?

- **Server Component (`src/app/page.tsx`):**
  Moved page data loading and search parameter resolution to a Server Component. It resolves `searchParams`, filters `ALL_EVENTS` on the server, and renders the page shell wrapped in `<Suspense>`. Centralizing data filtering on the server eliminates client-side fetch waterfalls on mount.
- **Client Components:**
  - `DashboardClient.tsx`: Manages interactive layout, client routing, debounced search synchronization, and event selection.
  - `StreamingSummaryDrawer.tsx`: Structural drawer container and selection header.
  - `StreamingSummaryText.tsx`: Leaf component that encapsulates the active stream reader and token state.
  - `HeavyPayloadFormatter.tsx`: Syntax formatter memoized with `React.memo` and `useMemo` so it only recalculates when `rawPayload` changes.
  - `EventList.tsx`, `FilterBar.tsx`: Memoized presentation components.
- **Serializable Props Crossing Boundary:**
  `events: SystemEvent[]`, `search: string`, `severity: string`. Only serializable plain objects and primitive strings cross the Server &rarr; Client boundary.

## 3. Stream Cancellation & Race-Condition Strategy
How did you guarantee that rapid clicks across multiple events never interleave chunks or throw unhandled `AbortError` exceptions? What happens if a user selects Event A -> Event B -> Event A quickly?

- **Stream Cancellation & Error Handling:** `StreamingSummaryText` manages an `AbortController`. Before starting a stream, any active controller is aborted (`controller.abort()`). A fresh controller is passed to `fetch('/api/stream-summary', { signal })`. Stale microtasks verify `generationRef`, and errors with `err.name === 'AbortError'` are caught and suppressed to prevent console/UI errors.
- **Immediate Filter-Driven Cancellation:** In `DashboardClient.tsx`, typing in search or clicking a severity immediately clears selection (`setSelectedEvent(null)`), instantly aborting any active stream without waiting for the 300ms debounce timer.
- **Rapid Switching (Event A -> Event B -> Event A):** `StreamingSummaryDrawer` sets `key={selectedEvent?.id ?? "none"}` on `StreamingSummaryText`. When the event ID changes, React unmounts the previous component instance (triggering effect cleanup and aborting the stream) and mounts a clean instance with empty state. Generation tokens ensure any late chunk from an in-flight read is discarded.

## 4. State Synchronization & Render Performance
- **Synchronizing filter inputs without useEffect feedback loops:**
  - *Immediate Local State:* Typing updates local `searchInput` immediately for zero typing lag and clears `selectedEvent` to cancel active streams.
  - *Debounced URL Navigation:* A 300ms debounce timer commits search changes via `router.push(..., { scroll: false })` so browser Back/Forward navigation works.
  - *Preserving Pending Search on Filter Clicks:* When clicking a severity filter, `handleSeverityChange` clears the pending search timer and commits both the new severity and the pending `searchInput` in one atomic navigation URL.
  - *Expected Route Matching vs. History Traversal:* Rather than a brittle boolean flag, an `expectedQueryRef` tracks `{ search, severity }` query parameters targetted by programmatic navigations. When the URL effect fires, matching queries consume the expectation without modifying local input state; non-matching queries (browser Back/Forward navigation) update local state to match the historical URL.
- **Render Isolation, Environment Compatibility & Automated Tests:**
  - Token updates are restricted to the `StreamingSummaryText` leaf component; parent drawers, `HeavyPayloadFormatter`, `EventList`, and `FilterBar` do not re-render as tokens stream in.
  - Pinned `jsdom@^26.0.0` with `"engines": { "node": ">=18.18.0" }` in `package.json` for broad compatibility across Node 18, 20, and 22 LTS environments.
  - 11 automated tests (`npm test`) verify:
    1. Stream cancellation and instance isolation on event switching (`tests/stream_cancellation.test.mjs`).
    2. Immediate stream abort on search typing and selection reconciliation on severity changes (`tests/filter_reconciliation.test.mjs`).
    3. Payload formatter memoization skipping calculations when props are unchanged (`tests/render_isolation.test.mjs`).
    4. Real DOM component integration tests with JSDOM verifying mounting, event dispatch, drawer instance replacement, expected query transitions, and pending search preservation (`tests/component_integration.test.mjs`).
