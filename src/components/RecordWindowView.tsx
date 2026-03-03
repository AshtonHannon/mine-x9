import { useEffect, useMemo, useState } from "react";

import { getRecordImage, parseX937File } from "../features/x937/api";
import { findRecordByIndex } from "../features/x937/selectors";
import type { ParsedRecord, RecordImage } from "../features/x937/types";
import { ResizableTable } from "./ResizableTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RecordWindowView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const filePath = params.get("filePath");
  const recordIndex = Number(params.get("recordIndex"));

  const [record, setRecord] = useState<ParsedRecord | null>(null);
  const [image, setImage] = useState<RecordImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecord() {
      if (!filePath || Number.isNaN(recordIndex)) {
        setError("Missing file path or record index.");
        return;
      }

      try {
        const parsedFile = await parseX937File(filePath);
        const found = findRecordByIndex(parsedFile, recordIndex);
        if (!found) {
          setError("Record not found.");
          return;
        }

        setRecord(found);
        if (found.recordType === "52") {
          const nextImage = await getRecordImage(filePath, found.index);
          setImage(nextImage);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err);
        setError(message || "Unable to load record.");
      }
    }

    void loadRecord();
  }, [filePath, recordIndex]);

  if (error) {
    return <main className="p-5 text-sm text-red-700">{error}</main>;
  }

  if (!record) {
    return <main className="p-5 text-sm text-slate-600">Loading record...</main>;
  }

  return (
    <main className="h-screen overflow-auto bg-slate-50 p-5 text-slate-900">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {record.recordName} <span className="font-mono text-sm text-teal-700">({record.recordType})</span>
          </CardTitle>
          <CardDescription>
            Record #{record.index + 1} - Line {record.lineNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResizableTable fields={record.fields} />

          {image ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs text-slate-600">
                {image.mimeType} - {image.byteLen.toLocaleString()} bytes
              </p>
              <img
                src={`data:${image.mimeType};base64,${image.dataBase64}`}
                alt={`Check image extracted from record ${image.recordIndex + 1}`}
                className="max-h-[520px] w-auto max-w-full rounded border border-slate-300 bg-white"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
