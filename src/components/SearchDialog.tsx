import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ParsedFile, ParsedRecord, EntryGroup } from "@/features/x937/types";

type SearchResult = {
  type: "entry" | "record";
  entry: EntryGroup;
  record?: ParsedRecord;
  matchedField?: string;
  matchedValue?: string;
  highlightText: string;
};

type SearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedFile: ParsedFile | null;
  onSelectEntry: (entry: EntryGroup) => void;
  onSelectRecord: (record: ParsedRecord) => void;
};

export function SearchDialog({
  open,
  onOpenChange,
  parsedFile,
  onSelectEntry,
  onSelectRecord,
}: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Reset search query when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const searchResults = useMemo(() => {
    if (!parsedFile || !searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Search through all entries
    parsedFile.entries.forEach((entry) => {
      // Check if entry label matches
      if (entry.label.toLowerCase().includes(query)) {
        results.push({
          type: "entry",
          entry,
          highlightText: entry.label,
        });
      }

      // Search through records in this entry
      entry.records.forEach((record) => {
        // Search through all fields in the record
        record.fields.forEach((field) => {
          const fieldValue = field.value.toLowerCase();
          const fieldName = field.name.toLowerCase();

          // Check for matches in routing number, account number, or sequence number
          const isRoutingNumber = fieldName.includes("routing");
          const isAccountNumber = fieldName.includes("on-us") || fieldName.includes("account");
          const isSequenceNumber = fieldName.includes("sequence");

          if (
            (isRoutingNumber || isAccountNumber || isSequenceNumber) &&
            fieldValue.includes(query)
          ) {
            results.push({
              type: "record",
              entry,
              record,
              matchedField: field.name,
              matchedValue: field.value,
              highlightText: `${entry.label} - ${record.recordName} - ${field.name}: ${field.value}`,
            });
          }
        });
      });
    });

    return results;
  }, [parsedFile, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      handleSelectResult(searchResults[selectedIndex]);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === "record" && result.record) {
      onSelectRecord(result.record);
      onSelectEntry(result.entry);
    } else {
      onSelectEntry(result.entry);
    }
    onOpenChange(false);
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    const selectedElement = document.getElementById(`search-result-${selectedIndex}`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Check Details</DialogTitle>
          <DialogDescription>
            Search by routing number, account number, or sequence number
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <Input
            placeholder="Enter routing number, account number, or sequence number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full"
          />

          {searchQuery && (
            <div className="text-sm text-muted-foreground">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
            </div>
          )}

          <div className="flex-1 overflow-y-auto border rounded-md">
            {searchResults.length > 0 ? (
              <div className="divide-y">
                {searchResults.map((result, index) => (
                  <div
                    key={`${result.entry.id}-${result.record?.id || ""}-${index}`}
                    id={`search-result-${index}`}
                    className={`p-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => handleSelectResult(result)}
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant={result.type === "entry" ? "default" : "secondary"}>
                        {result.type === "entry" ? "Entry" : "Record"}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm break-all">
                          {result.highlightText}
                        </div>
                        {result.matchedField && result.matchedValue && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.matchedField}: {result.matchedValue}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="p-8 text-center text-muted-foreground">
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Start typing to search...
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Use ↑↓ arrow keys to navigate, Enter to select
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
