import { useEffect, useState } from "react";

import { getRecordImage } from "../features/x937/api";
import type { EntryGroup, ParsedRecord, RecordImage } from "../features/x937/types";
import { ResizableTable } from "./ResizableTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RecordDetailsProps = {
  filePath: string | null;
  selectedRecord: ParsedRecord | null;
  selectedEntry: EntryGroup | null;
  onOpenFile: () => void;
  onOpenRecordWindow: (record: ParsedRecord) => void;
};

export function RecordDetails({
  filePath,
  selectedRecord,
  selectedEntry,
  onOpenFile,
  onOpenRecordWindow,
}: RecordDetailsProps) {
  const [imagesByRecord, setImagesByRecord] = useState<Record<string, RecordImage>>({});
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    async function loadImages() {
      setImagesByRecord({});
      setImageError(null);

      if (!filePath || !selectedEntry) {
        return;
      }

      const imageRecords = selectedEntry.records.filter((record) => record.recordType === "52");
      if (imageRecords.length === 0) {
        return;
      }

      try {
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
        setImageError(message || "Unable to decode image payload.");
      }
    }

    void loadImages();
  }, [filePath, selectedEntry]);

  if (!selectedRecord && !selectedEntry) {
    return (
      <section className="flex h-full items-center justify-center overflow-auto p-5">
        <Card className="w-full max-w-xl text-center">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl">Welcome to MineX9</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Open an X9.37 file to explore grouped records and inspect every field and check image.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            <Button onClick={onOpenFile} size="lg">
              Open X9 File
            </Button>
            <p className="text-sm text-slate-500">or drag and drop a file here</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (selectedRecord) {
    return (
      <section className="h-full overflow-auto p-5">
        <RecordCard
          record={selectedRecord}
          image={imagesByRecord[selectedRecord.id]}
          onDoubleClick={() => onOpenRecordWindow(selectedRecord)}
        />
      </section>
    );
  }

  const images = Object.values(imagesByRecord);

  return (
    <section className="h-full overflow-auto p-5">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{selectedEntry?.label}</CardTitle>
          <CardDescription>
            {selectedEntry?.records.length} related records
          </CardDescription>
          {imageError ? <p className="mt-2 text-sm text-red-700">{imageError}</p> : null}
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
        {selectedEntry?.records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            onDoubleClick={() => onOpenRecordWindow(record)}
          />
        ))}
      </div>
    </section>
  );
}

type RecordCardProps = {
  record: ParsedRecord;
  image?: RecordImage;
  onDoubleClick?: () => void;
};

function RecordCard({ record, image, onDoubleClick }: RecordCardProps) {
  return (
    <Card onDoubleClick={onDoubleClick}>
      <CardHeader>
        <CardTitle className="text-base">
          {record.recordName} <span className="font-mono text-sm text-primary">({record.recordType})</span>
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
              className="max-h-[420px] w-auto max-w-full rounded border border-slate-300 bg-white"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
