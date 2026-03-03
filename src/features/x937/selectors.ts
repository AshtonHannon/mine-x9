import type {
  BundleNode,
  CashLetterNode,
  EntryGroup,
  FileTree,
  ParsedFile,
  ParsedRecord,
} from "./types";

export function flattenRecords(parsedFile: ParsedFile): ParsedRecord[] {
  return [
    ...parsedFile.fileHeaders,
    ...parsedFile.batchHeaders,
    ...parsedFile.entries.flatMap((entry) => entry.records),
    ...parsedFile.batchFooters,
    ...parsedFile.fileFooters,
  ];
}

export function findRecordByIndex(parsedFile: ParsedFile, recordIndex: number): ParsedRecord | null {
  return flattenRecords(parsedFile).find((record) => record.index === recordIndex) ?? null;
}

export function findEntryByIndex(parsedFile: ParsedFile, entryIndex: number): EntryGroup | null {
  return parsedFile.entries.find((entry) => entry.index === entryIndex) ?? null;
}

/**
 * Build a hierarchical tree from the flat ParsedFile.
 *
 * The flat arrays are already in file order. We reconstruct the hierarchy by
 * walking through all records sorted by their index and nesting:
 *   File Header (01)
 *     Cash Letter Header (10)
 *       Bundle Header (20)
 *         Entries (25/31/61 + addenda)
 *       Bundle Control (70)
 *     Cash Letter Control (90)
 *   File Control (99)
 */
export function buildFileTree(parsedFile: ParsedFile): FileTree {
  // Collect ALL records/entries into a single ordered stream by index
  type Item =
    | { kind: "record"; record: ParsedRecord }
    | { kind: "entry"; entry: EntryGroup };

  const items: Item[] = [];

  for (const r of parsedFile.fileHeaders) items.push({ kind: "record", record: r });
  for (const r of parsedFile.batchHeaders) items.push({ kind: "record", record: r });
  for (const e of parsedFile.entries) {
    // Use the first record's index as the sort key for the entry group
    items.push({ kind: "entry", entry: e });
  }
  for (const r of parsedFile.batchFooters) items.push({ kind: "record", record: r });
  for (const r of parsedFile.fileFooters) items.push({ kind: "record", record: r });

  // Sort by the position in the original file
  items.sort((a, b) => {
    const indexA = a.kind === "record" ? a.record.index : (a.entry.records[0]?.index ?? 0);
    const indexB = b.kind === "record" ? b.record.index : (b.entry.records[0]?.index ?? 0);
    return indexA - indexB;
  });

  const tree: FileTree = {
    fileHeader: null,
    cashLetters: [],
    fileFooter: null,
    orphanRecords: [],
    orphanEntries: [],
  };

  let currentCashLetter: CashLetterNode | null = null;
  let currentBundle: BundleNode | null = null;

  function finishBundle() {
    if (currentBundle && currentCashLetter) {
      currentCashLetter.bundles.push(currentBundle);
      currentBundle = null;
    }
  }

  function finishCashLetter() {
    finishBundle();
    if (currentCashLetter) {
      tree.cashLetters.push(currentCashLetter);
      currentCashLetter = null;
    }
  }

  for (const item of items) {
    if (item.kind === "entry") {
      if (currentBundle) {
        currentBundle.entries.push(item.entry);
      } else {
        // Entry outside a bundle -- orphan
        tree.orphanEntries.push(item.entry);
      }
      continue;
    }

    const record = item.record;
    const rt = record.recordType;

    switch (rt) {
      case "01":
        tree.fileHeader = record;
        break;

      case "10":
        finishCashLetter();
        currentCashLetter = { header: record, bundles: [], footer: null };
        break;

      case "20":
        finishBundle();
        currentBundle = { header: record, entries: [], footer: null };
        break;

      case "70":
        if (currentBundle) {
          currentBundle.footer = record;
          finishBundle();
        } else {
          tree.orphanRecords.push(record);
        }
        break;

      case "90":
        finishBundle();
        if (currentCashLetter) {
          currentCashLetter.footer = record;
          finishCashLetter();
        } else {
          tree.orphanRecords.push(record);
        }
        break;

      case "99":
        finishCashLetter();
        tree.fileFooter = record;
        break;

      default:
        // Unknown record types -- treat as orphans
        tree.orphanRecords.push(record);
        break;
    }
  }

  // Flush any in-progress structures
  finishCashLetter();

  return tree;
}
