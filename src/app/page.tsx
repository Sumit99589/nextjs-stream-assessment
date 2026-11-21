import React, { Suspense } from "react";
import { ALL_EVENTS } from "@/lib/mockData";
import { DashboardClient } from "@/components/DashboardClient";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    severity?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const search = (resolvedParams.search || "").toLowerCase().trim();
  const severity = resolvedParams.severity || "all";

  // Server Component is the single source of truth for filtered events
  const filteredEvents = ALL_EVENTS.filter((evt) => {
    const matchesSeverity = severity === "all" || evt.severity === severity;
    const matchesSearch =
      !search ||
      evt.title.toLowerCase().includes(search) ||
      evt.service.toLowerCase().includes(search) ||
      evt.id.toLowerCase().includes(search);
    return matchesSeverity && matchesSearch;
  });

  return (
    <Suspense fallback={<div style={{ padding: "20px", color: "#94a3b8" }}>Loading dashboard...</div>}>
      <DashboardClient
        events={filteredEvents}
        search={resolvedParams.search || ""}
        severity={severity}
      />
    </Suspense>
  );
}
