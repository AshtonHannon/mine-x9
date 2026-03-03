import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { EntryGroup, ParsedRecord } from "./types";

export function openRecordWindow(filePath: string, record: ParsedRecord) {
  const label = `record-${record.index}-${Date.now()}`;
  const search = new URLSearchParams({
    recordWindow: "1",
    filePath,
    recordIndex: String(record.index),
  });

  const windowRef = new WebviewWindow(label, {
    title: `${record.recordType} ${record.recordName}`,
    width: 980,
    height: 760,
    url: `/?${search.toString()}`,
  });

  windowRef.once("tauri://error", () => {
    // no-op: main window handles failures gracefully
  });
}

export function openEntryWindow(filePath: string, entry: EntryGroup) {
  const label = `entry-${entry.index}-${Date.now()}`;
  const search = new URLSearchParams({
    entryWindow: "1",
    filePath,
    entryIndex: String(entry.index),
  });

  const windowRef = new WebviewWindow(label, {
    title: entry.label,
    width: 1100,
    height: 820,
    url: `/?${search.toString()}`,
  });

  windowRef.once("tauri://error", () => {
    // no-op
  });
}
