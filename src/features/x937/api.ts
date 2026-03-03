import { invoke } from "@tauri-apps/api/core";

import type { ParsedFile, RecordImage } from "./types";

export async function parseX937File(filePath: string): Promise<ParsedFile> {
  return invoke<ParsedFile>("parse_x937_file", { filePath });
}

export async function getRecordImage(
  filePath: string,
  recordIndex: number,
): Promise<RecordImage | null> {
  return invoke<RecordImage | null>("get_record_image", { filePath, recordIndex });
}
