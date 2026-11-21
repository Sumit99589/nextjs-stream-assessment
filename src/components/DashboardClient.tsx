"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SystemEvent } from "@/lib/mockData";
import { FilterBar } from "@/components/FilterBar";
import { EventList } from "@/components/EventList";
import { StreamingSummaryDrawer } from "@/components/StreamingSummaryDrawer";

interface DashboardClientProps {
  events: SystemEvent[];
  search: string;
  severity: string;
}

export function DashboardClient({
  events,
  search: initialSearch,
  severity: initialSeverity,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlSeverity = searchParams.get("severity") || "all";

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(initialSearch || urlSearch);

  // Selected event state
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(
    events.length > 0 ? events[0] : null
  );

  const renderCount = useRef(0);
  renderCount.current += 1;

  // Navigation-specific state tracking programmatic route transitions to prevent race conditions
  // during rapid typing, severity changes, and browser history traversal
  const expectedQueryRef = useRef<{ search: string; severity: string } | null>(null);

  // Ref tracking the pending search debounce timer to prevent overlapping navigation races
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Immediate search change handler: clears selection IMMEDIATELY upon typing to cancel any in-flight stream
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setSelectedEvent(null); // Immediate stream cancellation on typing!
  }, []);

  // Immediate severity change handler: cancels pending search debounce, preserves pending search text,
  // clears selection, and pushes URL update
  const handleSeverityChange = useCallback(
    (newSeverity: string) => {
      setSelectedEvent(null); // Immediate stream cancellation!

      // Explicitly cancel any pending search debounce timer before committing severity navigation
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }

      const params = new URLSearchParams(searchParams.toString());
      if (newSeverity !== "all") {
        params.set("severity", newSeverity);
      } else {
        params.delete("severity");
      }

      // Preserve any pending search input in the URL transition so it is not overwritten
      const targetSearch = searchInput.trim();
      if (targetSearch) {
        params.set("search", targetSearch);
      } else {
        params.delete("search");
      }

      const targetSeverity = newSeverity !== "all" ? newSeverity : "";
      expectedQueryRef.current = { search: targetSearch, severity: targetSeverity };
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [searchParams, searchInput, router]
  );

  // Browser Back/Forward navigation sync: clears selection and reconciles search input
  const prevUrlRef = useRef({ search: urlSearch, severity: urlSeverity });
  useEffect(() => {
    if (prevUrlRef.current.search !== urlSearch || prevUrlRef.current.severity !== urlSeverity) {
      prevUrlRef.current = { search: urlSearch, severity: urlSeverity };
      setSelectedEvent(null); // Clear selection and abort stream on Back/Forward navigation!

      const isProgrammaticMatch =
        expectedQueryRef.current !== null &&
        expectedQueryRef.current.search === urlSearch &&
        expectedQueryRef.current.severity === urlSeverity;

      if (isProgrammaticMatch) {
        // Nav originated from internal UI (e.g. handleSeverityChange or debounced search)
        expectedQueryRef.current = null;
      } else {
        // Nav originated from browser Back/Forward button
        if (urlSearch !== searchInput) {
          setSearchInput(urlSearch);
        }
      }
    }
  }, [urlSearch, urlSeverity, searchInput]);

  // Reconcile selected event when filtered event list updates:
  // If the previously selected event is no longer in the filtered results, clear selection
  useEffect(() => {
    if (selectedEvent) {
      const stillPresent = events.some((e) => e.id === selectedEvent.id);
      if (!stillPresent) {
        setSelectedEvent(null);
      }
    }
  }, [events, selectedEvent]);

  // Debounced search URL synchronization: 300ms timer commits search to URL via router.push
  // This allows browser Back/Forward navigation to restore committed search states
  useEffect(() => {
    if (searchInput === urlSearch) return;

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    searchDebounceTimerRef.current = setTimeout(() => {
      searchDebounceTimerRef.current = null;
      const params = new URLSearchParams(searchParams.toString());
      const targetSearch = searchInput.trim();
      if (targetSearch) {
        params.set("search", targetSearch);
      } else {
        params.delete("search");
      }
      expectedQueryRef.current = { search: targetSearch, severity: urlSeverity };
      router.push(`/?${params.toString()}`, { scroll: false });
    }, 300);

    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }
    };
  }, [searchInput, urlSearch, urlSeverity, searchParams, router]);

  const handleSelectEvent = useCallback((evt: SystemEvent) => {
    setSelectedEvent(evt);
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", height: "100vh", overflow: "hidden" }}>
      {/* Left Pane: Filters & 500-Row Event List */}
      <div style={{ borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <FilterBar
          search={searchInput}
          onSearchChange={handleSearchChange}
          severity={urlSeverity}
          onSeverityChange={handleSeverityChange}
          pageRenders={renderCount.current}
        />
        <EventList
          events={events}
          selectedEventId={selectedEvent?.id || null}
          onSelectEvent={handleSelectEvent}
          loadingEvents={false}
        />
      </div>

      {/* Right Pane: Streaming Incident Drawer */}
      <StreamingSummaryDrawer selectedEvent={selectedEvent} />
    </div>
  );
}
