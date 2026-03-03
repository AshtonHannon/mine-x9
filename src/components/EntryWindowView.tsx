import { useEffect, useMemo, useState } from "react";

import { getRecordImage, parseX937File } from "../features/x937/api";
import { findEntryByIndex } from "../features/x937/selectors";
import type { EntryGroup, RecordImage } from "../features/x937/types";
import { ResizableTable } from "./ResizableTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EntryWindowView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const filePath = params.get("filePath");
  const entryIndex = Number(params.get("entryIndex"));

  const [entry, setEntry] = useState<EntryGroup | null>(null);
  const [imagesByRecord, setImagesByRecord] = useState<Record<string, RecordImage>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntry() {
      if (!filePath || Number.isNaN(entryIndex)) {
        setError("Missing file path or entry index.");
        return;
      }

      try {
        const parsedFile = await parseX937File(filePath);
        const found = findEntryByIndex(parsedFile, entryIndex);
        if (!found) {
          setError("Entry not found.");
          return;
        }

        setEntry(found);

        const imageRecords = found.records.filter((record) => record.recordType === "52");
        if (imageRecords.length === 0) {
          return;
        }

        const loaded = await Promise.all(
          imageRecords.map(async (record) => {
            const image = await getRecordImage(filePath, record.index);
            return [record.id, image] as const;
          }),
        );

        const nextMap: Record<string, RecordImage> = {};
        loaded.forEach(([recordId, image]) => {
          if (image) {
            nextMap[recordId] = image;
          }
        });

        setImagesByRecord(nextMap);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err);
        setError(message || "Unable to load entry.");
      }
    }

    void loadEntry();
  }, [entryIndex, filePath]);

  if (error) {
    return <main className="p-5 text-sm text-red-700">{error}</main>;
  }

  if (!entry) {
    return <main className="p-5 text-sm text-slate-600">Loading entry...</main>;
  }

  const images = Object.values(imagesByRecord);

  return (
    <main className="h-screen overflow-auto bg-slate-50 p-5 text-slate-900">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{entry.label}</CardTitle>
          <CardDescription>{entry.records.length} related records</CardDescription>
        </CardHeader>
      </Card>

      {images.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Check Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {images.map((image) => (
                <div key={image.recordIndex} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-600">
                    Record #{image.recordIndex + 1} - {image.mimeType} - {image.byteLen.toLocaleString()} bytes
                  </p>
                  <img
                    src={`data:${image.mimeType};base64,${image.dataBase64}`}
                    alt={`Check image extracted from record ${image.recordIndex + 1}`}
                    className="w-full h-auto rounded border border-slate-300 bg-white"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {entry.records.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {record.recordName} <span className="font-mono text-sm text-teal-700">({record.recordType})</span>
              </CardTitle>
              <CardDescription>
                Record #{record.index + 1} - Line {record.lineNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResizableTable fields={record.fields} />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
