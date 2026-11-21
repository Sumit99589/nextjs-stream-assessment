"use client";

import React from "react";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  severity: string;
  onSeverityChange: (value: string) => void;
  pageRenders: number;
}

export const FilterBar = React.memo(function FilterBar({
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  pageRenders,
}: FilterBarProps) {
  return (
    <div
      style={{
        padding: "16px",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter by service, title, or ID..."
        style={{
          flex: 1,
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #334155",
          background: "#1e293b",
          color: "#f8fafc",
        }}
      />
      <select
        value={severity}
        onChange={(e) => onSeverityChange(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #334155",
          background: "#1e293b",
          color: "#f8fafc",
        }}
      >
        <option value="all">All Severities</option>
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="critical">Critical</option>
      </select>
      <span style={{ fontSize: "12px", color: "#64748b" }}>Page renders: {pageRenders}</span>
    </div>
  );
});
