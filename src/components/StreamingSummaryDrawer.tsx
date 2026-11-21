"use client";

import React, { useState, useCallback } from "react";
import type { SystemEvent } from "@/lib/mockData";
import { HeavyPayloadFormatter } from "./HeavyPayloadFormatter";
import { StreamingSummaryText } from "./StreamingSummaryText";

interface StreamingSummaryDrawerProps {
  selectedEvent: SystemEvent | null;
}

export function StreamingSummaryDrawer({ selectedEvent }: StreamingSummaryDrawerProps) {
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamStateChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
  }, []);

  return (
    <div style={{ padding: "20px", overflowY: "auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>
          {selectedEvent ? `Analysis: ${selectedEvent.id}` : "Incident Summary"}
        </h2>
        {isStreaming && (
          <span style={{ fontSize: "12px", color: "#38bdf8" }}>
            Streaming tokens...
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Key tied to selected event guarantees instance isolation and immediate state reset on switch */}
        <StreamingSummaryText
          key={selectedEvent?.id ?? "none"}
          eventId={selectedEvent?.id ?? null}
          onStreamStateChange={handleStreamStateChange}
        />

        {/* Stable viewer: never re-renders on token arrivals */}
        <HeavyPayloadFormatter rawPayload={selectedEvent?.rawPayload || "{}"} />
      </div>
    </div>
  );
}
