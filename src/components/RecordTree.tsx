import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import type { BundleNode, CashLetterNode, EntryGroup, FileTree, ParsedRecord } from "../features/x937/types";
import appLogo from "../../src-tauri/icons/icon.png";

type RecordTreeProps = {
  filePath: string | null;
  fileTree: FileTree | null;
  selectedRecordId: string | null;
  selectedEntryId: string | null;
  onSelectRecord: (record: ParsedRecord) => void;
  onSelectEntry: (entry: EntryGroup) => void;
  onOpenRecordWindow: (record: ParsedRecord) => void;
  onOpenEntryWindow: (entry: EntryGroup) => void;
};

export function RecordTree({
  filePath,
  fileTree,
  selectedRecordId,
  selectedEntryId,
  onSelectRecord,
  onSelectEntry,
  onOpenRecordWindow,
  onOpenEntryWindow,
}: RecordTreeProps) {
  const fileTotalCents = useMemo(() => {
    if (!fileTree) return null;
    return sumCashLettersCents(fileTree.cashLetters) + sumEntriesCents(fileTree.orphanEntries);
  }, [fileTree]);

  return (
    <aside className="h-full overflow-y-auto border-r border-slate-200 bg-white/90 p-3">
      <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
        <img
          src={appLogo}
          alt="X9.37 logo"
          className="h-4 w-4 rounded-sm border border-slate-200 bg-white object-cover"
        />
        <div>
          <p className="text-sm font-semibold text-slate-800">MineX9</p>
          <p className="text-xs text-slate-500">File Explorer</p>
        </div>
      </div>

      {fileTree ? (
        <div className="space-y-0.5">
          {/* File Header */}
          {fileTree.fileHeader ? (
            <RecordRow
              record={fileTree.fileHeader}
              depth={0}
              amount={formatCents(fileTotalCents)}
              active={selectedRecordId === fileTree.fileHeader.id}
              onClick={() => onSelectRecord(fileTree.fileHeader!)}
              onDoubleClick={() => {
                if (filePath) onOpenRecordWindow(fileTree.fileHeader!);
              }}
            />
          ) : null}

          {/* Cash Letters */}
          {fileTree.cashLetters.map((cashLetter, clIdx) => (
            <CashLetterSection
              key={cashLetter.header.id}
              cashLetter={cashLetter}
              index={clIdx}
              filePath={filePath}
              selectedRecordId={selectedRecordId}
              selectedEntryId={selectedEntryId}
              onSelectRecord={onSelectRecord}
              onSelectEntry={onSelectEntry}
              onOpenRecordWindow={onOpenRecordWindow}
              onOpenEntryWindow={onOpenEntryWindow}
            />
          ))}

          {/* File Footer */}
          {fileTree.fileFooter ? (
            <RecordRow
              record={fileTree.fileFooter}
              depth={0}
              amount={formatCents(fileTotalCents)}
              active={selectedRecordId === fileTree.fileFooter.id}
              onClick={() => onSelectRecord(fileTree.fileFooter!)}
              onDoubleClick={() => {
                if (filePath) onOpenRecordWindow(fileTree.fileFooter!);
              }}
            />
          ) : null}

          {/* Orphan records */}
          {fileTree.orphanRecords.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              depth={0}
              active={selectedRecordId === record.id}
              onClick={() => onSelectRecord(record)}
              onDoubleClick={() => {
                if (filePath) onOpenRecordWindow(record);
              }}
            />
          ))}

          {/* Orphan entries */}
          {fileTree.orphanEntries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              depth={0}
              active={selectedEntryId === entry.id}
              onClick={() => onSelectEntry(entry)}
              onDoubleClick={() => {
                if (filePath) onOpenEntryWindow(entry);
              }}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Cash Letter collapsible section
// ---------------------------------------------------------------------------

type CashLetterSectionProps = {
  cashLetter: CashLetterNode;
  index: number;
  filePath: string | null;
  selectedRecordId: string | null;
  selectedEntryId: string | null;
  onSelectRecord: (record: ParsedRecord) => void;
  onSelectEntry: (entry: EntryGroup) => void;
  onOpenRecordWindow: (record: ParsedRecord) => void;
  onOpenEntryWindow: (entry: EntryGroup) => void;
};

function CashLetterSection({
  cashLetter,
  filePath,
  selectedRecordId,
  selectedEntryId,
  onSelectRecord,
  onSelectEntry,
  onOpenRecordWindow,
  onOpenEntryWindow,
}: CashLetterSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const totalCents = useMemo(
    () => sumCashLettersCents([cashLetter]),
    [cashLetter],
  );

  return (
    <div>
      {/* Cash Letter Header */}
      <CollapsibleRecordRow
        record={cashLetter.header}
        depth={1}
        expanded={expanded}
        amount={formatCents(totalCents)}
        onToggle={() => setExpanded((v) => !v)}
        active={selectedRecordId === cashLetter.header.id}
        onClick={() => onSelectRecord(cashLetter.header)}
        onDoubleClick={() => {
          if (filePath) onOpenRecordWindow(cashLetter.header);
        }}
      />

      {expanded ? (
        <>
          {/* Bundles */}
          {cashLetter.bundles.map((bundle, bIdx) => (
            <BundleSection
              key={bundle.header.id}
              bundle={bundle}
              index={bIdx}
              filePath={filePath}
              selectedRecordId={selectedRecordId}
              selectedEntryId={selectedEntryId}
              onSelectRecord={onSelectRecord}
              onSelectEntry={onSelectEntry}
              onOpenRecordWindow={onOpenRecordWindow}
              onOpenEntryWindow={onOpenEntryWindow}
            />
          ))}

          {/* Cash Letter Footer */}
          {cashLetter.footer ? (
            <RecordRow
              record={cashLetter.footer}
              depth={1}
              amount={formatCents(totalCents)}
              active={selectedRecordId === cashLetter.footer.id}
              onClick={() => onSelectRecord(cashLetter.footer!)}
              onDoubleClick={() => {
                if (filePath) onOpenRecordWindow(cashLetter.footer!);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bundle collapsible section
// ---------------------------------------------------------------------------

type BundleSectionProps = {
  bundle: BundleNode;
  index: number;
  filePath: string | null;
  selectedRecordId: string | null;
  selectedEntryId: string | null;
  onSelectRecord: (record: ParsedRecord) => void;
  onSelectEntry: (entry: EntryGroup) => void;
  onOpenRecordWindow: (record: ParsedRecord) => void;
  onOpenEntryWindow: (entry: EntryGroup) => void;
};

function BundleSection({
  bundle,
  filePath,
  selectedRecordId,
  selectedEntryId,
  onSelectRecord,
  onSelectEntry,
  onOpenRecordWindow,
  onOpenEntryWindow,
}: BundleSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const totalCents = useMemo(
    () => sumEntriesCents(bundle.entries),
    [bundle.entries],
  );

  return (
    <div>
      {/* Bundle Header */}
      <CollapsibleRecordRow
        record={bundle.header}
        depth={2}
        expanded={expanded}
        amount={formatCents(totalCents)}
        onToggle={() => setExpanded((v) => !v)}
        active={selectedRecordId === bundle.header.id}
        onClick={() => onSelectRecord(bundle.header)}
        onDoubleClick={() => {
          if (filePath) onOpenRecordWindow(bundle.header);
        }}
      />

      {expanded ? (
        <>
          {/* Entries */}
          {bundle.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              depth={3}
              active={selectedEntryId === entry.id}
              onClick={() => onSelectEntry(entry)}
              onDoubleClick={() => {
                if (filePath) onOpenEntryWindow(entry);
              }}
            />
          ))}

          {/* Bundle Footer */}
          {bundle.footer ? (
            <RecordRow
              record={bundle.footer}
              depth={2}
              amount={formatCents(totalCents)}
              active={selectedRecordId === bundle.footer.id}
              onClick={() => onSelectRecord(bundle.footer!)}
              onDoubleClick={() => {
                if (filePath) onOpenRecordWindow(bundle.footer!);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

const DEPTH_PADDING: Record<number, string> = {
  0: "pl-2",
  1: "pl-4",
  2: "pl-6",
  3: "pl-8",
};

type RecordRowProps = {
  record: ParsedRecord;
  depth: number;
  active: boolean;
  amount?: string | null;
  onClick: () => void;
  onDoubleClick?: () => void;
};

function RecordRow({ record, depth, active, amount, onClick, onDoubleClick }: RecordRowProps) {
  const pad = DEPTH_PADDING[depth] ?? "pl-2";

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`flex w-full items-center gap-1.5 rounded-md border py-1 pr-2 text-left text-sm transition ${pad} ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span className="shrink-0 font-mono text-[11px] font-semibold text-primary">{record.recordType}</span>
      <span className="min-w-0 flex-1 truncate text-xs">{record.recordName}</span>
      {amount ? (
        <span className="shrink-0 font-mono text-[10px] text-slate-500">{amount}</span>
      ) : null}
    </button>
  );
}

type CollapsibleRecordRowProps = RecordRowProps & {
  expanded: boolean;
  onToggle: () => void;
};

function CollapsibleRecordRow({
  record,
  depth,
  active,
  amount,
  expanded,
  onToggle,
  onClick,
  onDoubleClick,
}: CollapsibleRecordRowProps) {
  const pad = DEPTH_PADDING[depth] ?? "pl-2";

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group flex w-full items-center gap-1 rounded-md border py-1 pr-2 text-left text-sm transition ${pad} ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }
        }}
        className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-slate-200"
      >
        <ChevronRight
          className={`h-3 w-3 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </span>
      <span className="shrink-0 font-mono text-[11px] font-semibold text-primary">{record.recordType}</span>
      <span className="min-w-0 flex-1 truncate text-xs">{record.recordName}</span>
      {amount ? (
        <span className="shrink-0 font-mono text-[10px] text-slate-500">{amount}</span>
      ) : null}
    </button>
  );
}

type EntryRowProps = {
  entry: EntryGroup;
  depth: number;
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
};

function EntryRow({ entry, depth, active, onClick, onDoubleClick }: EntryRowProps) {
  const pad = DEPTH_PADDING[depth] ?? "pl-2";
  const amount = getEntryAmount(entry);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`flex w-full items-center justify-between rounded-md border py-1 pr-2 text-left text-sm transition ${pad} ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span className="truncate text-xs font-medium">{entry.label}</span>
      {amount !== null ? (
        <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-500">{amount}</span>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Amount helpers
// ---------------------------------------------------------------------------

/** Parse the raw cents value from an entry's primary record. Returns null if unavailable. */
function getEntryCents(entry: EntryGroup): number | null {
  const first = entry.records[0];
  if (!first) return null;

  const amountField = first.fields.find((f) => f.name === "Amount");
  if (!amountField) return null;

  const raw = amountField.value.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;

  const cents = Number.parseInt(raw, 10);
  return Number.isNaN(cents) ? null : cents;
}

/** Sum cents across a list of entries. */
function sumEntriesCents(entries: EntryGroup[]): number {
  let total = 0;
  for (const entry of entries) {
    const c = getEntryCents(entry);
    if (c !== null) total += c;
  }
  return total;
}

/** Sum cents across all bundles in a list of cash letters. */
function sumCashLettersCents(cashLetters: CashLetterNode[]): number {
  let total = 0;
  for (const cl of cashLetters) {
    for (const bundle of cl.bundles) {
      total += sumEntriesCents(bundle.entries);
    }
  }
  return total;
}

/** Format a cents value as a dollar string, or return null for zero. */
function formatCents(cents: number | null): string | null {
  if (cents === null || cents === 0) return null;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Extract and format the dollar amount from an entry's primary record. */
function getEntryAmount(entry: EntryGroup): string | null {
  return formatCents(getEntryCents(entry));
}
