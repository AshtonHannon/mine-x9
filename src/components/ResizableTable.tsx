import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RecordField } from "../features/x937/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ResizableTableProps = {
  fields: RecordField[];
};

const DEFAULT_COLUMN_WIDTHS = {
  field: 200,
  position: 120,
  value: 300,
};

type CellPosition = {
  row: number;
  col: number;
};

type CellRange = {
  start: CellPosition;
  end: CellPosition;
};

export function ResizableTable({ fields }: ResizableTableProps) {
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [selectedRange, setSelectedRange] = useState<CellRange | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const resizingColumn = useRef<keyof typeof DEFAULT_COLUMN_WIDTHS | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    column: keyof typeof DEFAULT_COLUMN_WIDTHS,
  ) => {
    e.preventDefault();
    resizingColumn.current = column;
    startX.current = e.clientX;
    startWidth.current = columnWidths[column];

    document.addEventListener("mousemove", handleResizeMouseMove);
    document.addEventListener("mouseup", handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;

    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff);

    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }));
  };

  const handleResizeMouseUp = () => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMouseMove);
    document.removeEventListener("mouseup", handleResizeMouseUp);
  };

  const handleCellMouseDown = (row: number, col: number) => {
    setIsSelecting(true);
    setSelectedRange({ start: { row, col }, end: { row, col } });
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isSelecting && selectedRange) {
      setSelectedRange({ ...selectedRange, end: { row, col } });
    }
  };

  const handleCellMouseUp = () => {
    setIsSelecting(false);
  };

  const isCellInRange = (row: number, col: number): boolean => {
    if (!selectedRange) return false;

    const minRow = Math.min(selectedRange.start.row, selectedRange.end.row);
    const maxRow = Math.max(selectedRange.start.row, selectedRange.end.row);
    const minCol = Math.min(selectedRange.start.col, selectedRange.end.col);
    const maxCol = Math.max(selectedRange.start.col, selectedRange.end.col);

    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedRange) {
        const minRow = Math.min(selectedRange.start.row, selectedRange.end.row);
        const maxRow = Math.max(selectedRange.start.row, selectedRange.end.row);
        const minCol = Math.min(selectedRange.start.col, selectedRange.end.col);
        const maxCol = Math.max(selectedRange.start.col, selectedRange.end.col);

        const rows: string[] = [];
        for (let row = minRow; row <= maxRow; row++) {
          const cols: string[] = [];
          for (let col = minCol; col <= maxCol; col++) {
            const field = fields[row];
            let value = "";
            switch (col) {
              case 0:
                value = field.name;
                break;
              case 1:
                value = `${field.start}-${field.end}`;
                break;
              case 2:
                value = field.value || "(blank)";
                break;
            }
            cols.push(value);
          }
          rows.push(cols.join("\t"));
        }

        // Use the Clipboard API
        navigator.clipboard
          .writeText(rows.join("\n"))
          .then(() => {
            toast.success("Copied to clipboard");
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
            toast.error("Failed to copy to clipboard");
          });

        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedRange, fields]);

  return (
    <>
      <div 
        className="overflow-hidden rounded-md border border-slate-200"
        onMouseUp={handleCellMouseUp}
        onMouseLeave={handleCellMouseUp}
      >
        <div className="overflow-x-auto">
          <Table className="text-sm" style={{ minWidth: "100%" }}>
          <TableHeader className="text-left text-xs uppercase tracking-wide">
            <TableRow>
              <TableHead
                className="relative"
                style={{ width: columnWidths.field }}
              >
                Field
                <div
                  className="absolute right-0 top-0 h-full w-1 bg-slate-300 cursor-col-resize hover:bg-primary resize-handle"
                  onMouseDown={(e) => handleResizeMouseDown(e, "field")}
                />
              </TableHead>
              <TableHead
                className="relative"
                style={{ width: columnWidths.position }}
              >
                Position
                <div
                  className="absolute right-0 top-0 h-full w-1 bg-slate-300 cursor-col-resize hover:bg-primary resize-handle"
                  onMouseDown={(e) => handleResizeMouseDown(e, "position")}
                />
              </TableHead>
              <TableHead
                className="relative"
                style={{ width: columnWidths.value }}
              >
                Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, rowIndex) => (
              <TableRow key={`${field.name}-${field.start}`}>
                <TableCell
                  className={`align-top cursor-pointer select-none ${
                    isCellInRange(rowIndex, 0) ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-slate-50"
                  }`}
                  style={{ width: columnWidths.field }}
                  onMouseDown={() => handleCellMouseDown(rowIndex, 0)}
                  onMouseEnter={() => handleCellMouseEnter(rowIndex, 0)}
                >
                  {field.name}
                </TableCell>
                <TableCell
                  className={`align-top text-slate-600 cursor-pointer select-none ${
                    isCellInRange(rowIndex, 1) ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-slate-50"
                  }`}
                  style={{ width: columnWidths.position }}
                  onMouseDown={() => handleCellMouseDown(rowIndex, 1)}
                  onMouseEnter={() => handleCellMouseEnter(rowIndex, 1)}
                >
                  {field.start}-{field.end}
                </TableCell>
                <TableCell
                  className={`align-top cursor-pointer select-none ${
                    isCellInRange(rowIndex, 2) ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-slate-50"
                  }`}
                  style={{ width: columnWidths.value }}
                  onMouseDown={() => handleCellMouseDown(rowIndex, 2)}
                  onMouseEnter={() => handleCellMouseEnter(rowIndex, 2)}
                >
                  {field.value || "(blank)"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>

  </>
  );
}
