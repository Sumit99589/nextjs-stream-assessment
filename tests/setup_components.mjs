import ts from "typescript";
import fs from "fs";
import path from "path";

const outDir = path.resolve("tests/.compiled");
fs.mkdirSync(outDir, { recursive: true });

// Write mock navigation context for Next.js navigation hooks
const mockNavCode = `
import React, { createContext, useContext } from "react";

export const NavigationContext = createContext({
  router: { push: () => {} },
  searchParams: new URLSearchParams(),
});

export function useRouter() {
  return useContext(NavigationContext).router;
}

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
}
`;
fs.writeFileSync(path.join(outDir, "mockNavigation.mjs"), mockNavCode);

const files = [
  "FilterBar.tsx",
  "EventList.tsx",
  "HeavyPayloadFormatter.tsx",
  "StreamingSummaryText.tsx",
  "StreamingSummaryDrawer.tsx",
  "DashboardClient.tsx",
];

for (const f of files) {
  let code = fs.readFileSync(path.resolve("src/components", f), "utf-8");
  // Replace imports for Node ESM resolution
  code = code.replace(/from\s+["']next\/navigation["']/g, 'from "./mockNavigation"');
  code = code.replace(/from\s+["']@\/components\/([^"']+)["']/g, 'from "./$1"');
  code = code.replace(/from\s+["'](\.\/[^"']+)["']/g, 'from "$1.mjs"');
  const res = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022
    }
  });
  fs.writeFileSync(path.join(outDir, f.replace(".tsx", ".mjs")), res.outputText);
}
console.log("All components (including DashboardClient) compiled to tests/.compiled");
