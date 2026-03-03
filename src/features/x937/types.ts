export type RecordField = {
  name: string;
  start: number;
  end: number;
  value: string;
};

export type ParsedRecord = {
  id: string;
  recordType: string;
  recordName: string;
  index: number;
  lineNumber: number;
  raw: string;
  fields: RecordField[];
};

export type RecordImage = {
  mimeType: string;
  dataBase64: string;
  byteLen: number;
  recordIndex: number;
  lineNumber: number;
};

export type EntryGroup = {
  id: string;
  label: string;
  index: number;
  records: ParsedRecord[];
};

export type ParsedFile = {
  filePath: string;
  totalRecords: number;
  fileHeaders: ParsedRecord[];
  batchHeaders: ParsedRecord[];
  entries: EntryGroup[];
  batchFooters: ParsedRecord[];
  fileFooters: ParsedRecord[];
};

// Hierarchical tree types for cascading sidebar view
export type BundleNode = {
  header: ParsedRecord;
  entries: EntryGroup[];
  footer: ParsedRecord | null;
};

export type CashLetterNode = {
  header: ParsedRecord;
  bundles: BundleNode[];
  footer: ParsedRecord | null;
};

export type FileTree = {
  fileHeader: ParsedRecord | null;
  cashLetters: CashLetterNode[];
  fileFooter: ParsedRecord | null;
  // Orphan records that don't fit the hierarchy
  orphanRecords: ParsedRecord[];
  orphanEntries: EntryGroup[];
};
