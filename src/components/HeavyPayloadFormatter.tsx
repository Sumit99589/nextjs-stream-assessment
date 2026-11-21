"use client";

import React, { useMemo } from "react";

export interface HeavyPayloadFormatterProps {
  rawPayload: string;
}

/**
 * Simulates an expensive markdown / syntax highlighting component for raw telemetry.
 * Memoized on rawPayload so that it is never re-rendered by streaming token updates.
 */
export const HeavyPayloadFormatter = React.memo(function HeavyPayloadFormatter({
  rawPayload,
}: HeavyPayloadFormatterProps) {
  // Simulate ~12ms of synchronous formatting work per render, memoized on rawPayload
  const formattedData = useMemo(() => {
    const start = performance.now();
    let checksum = 0;
    while (performance.now() - start < 12) {
      checksum = (checksum + 1) % 1000;
    }
    return { checksum, payload: rawPayload };
  }, [rawPayload]);

  return (
    <details open data-checksum={formattedData.checksum}>
      <summary style={{ cursor: "pointer", color: "#94a3b8", fontSize: "13px" }}>
        Raw Telemetry Payload
      </summary>
      <pre
        style={{
          background: "#020617",
          padding: "12px",
          borderRadius: "6px",
          fontSize: "12px",
          overflowX: "auto",
        }}
      >
        {formattedData.payload}
      </pre>
    </details>
  );
});
