"use client";

import React from "react";
import type { SystemEvent } from "@/lib/mockData";

interface EventListProps {
  events: SystemEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: SystemEvent) => void;
  loadingEvents: boolean;
}

export const EventList = React.memo(function EventList({
  events,
  selectedEventId,
  onSelectEvent,
  loadingEvents,
}: EventListProps) {
  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {loadingEvents && <div style={{ padding: "12px", color: "#94a3b8" }}>Loading events...</div>}
      {events.map((evt) => (
        <div
          key={evt.id}
          onClick={() => onSelectEvent(evt)}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1e293b",
            cursor: "pointer",
            background: selectedEventId === evt.id ? "#1e293b" : "transparent",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500 }}>{evt.title}</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              {evt.id} · {evt.timestamp}
            </div>
          </div>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "999px",
              background:
                evt.severity === "critical" ? "#7f1d1d" : evt.severity === "warning" ? "#78350f" : "#1e3a8a",
              color: "#f8fafc",
            }}
          >
            {evt.severity}
          </span>
        </div>
      ))}
      {!loadingEvents && events.length === 0 && (
        <div style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>
          No system events match your criteria.
        </div>
      )}
    </div>
  );
});
