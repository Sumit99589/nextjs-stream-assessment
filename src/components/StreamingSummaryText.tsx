"use client";

import React, { useEffect, useRef, useState } from "react";

interface StreamingSummaryTextProps {
  eventId: string | null;
  onStreamStateChange?: (isStreaming: boolean) => void;
}

/**
 * Isolated leaf component that owns the streaming token state.
 * Only this component re-renders when new chunks arrive, preventing
 * re-renders in the parent drawer, the payload viewer, or the event list.
 */
export function StreamingSummaryText({
  eventId,
  onStreamStateChange,
}: StreamingSummaryTextProps) {
  const [text, setText] = useState("");
  const activeControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    // 1. Abort existing stream if active
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    if (!eventId) {
      setText("");
      onStreamStateChange?.(false);
      return;
    }

    const currentGeneration = ++generationRef.current;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const currentId = eventId;

    setText("");
    onStreamStateChange?.(true);

    async function stream() {
      try {
        const res = await fetch(
          `/api/stream-summary?eventId=${encodeURIComponent(currentId)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Failed to stream: ${res.status}`);
        }

        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            if (controller.signal.aborted || generationRef.current !== currentGeneration) {
              await reader.cancel().catch(() => {});
              break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            if (controller.signal.aborted || generationRef.current !== currentGeneration) {
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // Only this leaf component re-renders as chunks arrive
            setText((prev) => prev + chunk);
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        console.error("Stream reading error:", err);
      } finally {
        if (!controller.signal.aborted && generationRef.current === currentGeneration) {
          onStreamStateChange?.(false);
        }
      }
    }

    stream();

    return () => {
      controller.abort();
    };
  }, [eventId, onStreamStateChange]);

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "14px",
        borderRadius: "8px",
        border: "1px solid #334155",
        whiteSpace: "pre-wrap",
        lineHeight: 1.55,
        minHeight: "180px",
      }}
    >
      {text || (eventId ? "Generating AI analysis..." : "Select an event to view incident summary...")}
    </div>
  );
}
