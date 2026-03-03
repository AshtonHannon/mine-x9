import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import { EntryWindowView } from "./components/EntryWindowView";
import { RecordDetails } from "./components/RecordDetails";
import { RecordTree } from "./components/RecordTree";
import { RecordWindowView } from "./components/RecordWindowView";
import { SearchDialog } from "./components/SearchDialog";
import { parseX937File } from "./features/x937/api";
import { buildFileTree } from "./features/x937/selectors";
import { openEntryWindow, openRecordWindow } from "./features/x937/windows";
import type { EntryGroup, ParsedFile, ParsedRecord } from "./features/x937/types";
import { Toaster } from "@/components/ui/sonner";

const searchParams = new URLSearchParams(window.location.search);
const isRecordWindow = searchParams.get("recordWindow") === "1";
const isEntryWindow = searchParams.get("entryWindow") === "1";

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ParsedRecord | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<EntryGroup | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const fileTree = useMemo(() => (parsedFile ? buildFileTree(parsedFile) : null), [parsedFile]);

  async function chooseFile() {
    const path = await open({
      multiple: false,
      directory: false,
      title: "Choose an X9.37 File",
      filters: [{ name: "X9.37 files", extensions: ["x937", "x9", "txt", "dat"] }],
    });

    if (!path) {
      return;
    }

    await loadFile(path);
  }

  async function loadFile(path: string) {
    setSelectedPath(path);
    setParsedFile(null);
    setSelectedRecord(null);
    setSelectedEntry(null);
    setError(null);

    try {
      const nextParsedFile = await parseX937File(path);
      setParsedFile(nextParsedFile);

      const firstEntry = nextParsedFile.entries[0] ?? null;
      if (firstEntry) {
        setSelectedEntry(firstEntry);
        return;
      }

      const firstRecord =
        nextParsedFile.fileHeaders[0] ??
        nextParsedFile.batchHeaders[0] ??
        nextParsedFile.batchFooters[0] ??
        nextParsedFile.fileFooters[0] ??
        null;
      setSelectedRecord(firstRecord);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      setError(message || "Unable to parse selected file.");
    }
  }

  useEffect(() => {
    let unlistenOpenFile: (() => void) | null = null;
    let unlistenSearch: (() => void) | null = null;
    let unlistenFileDrop: (() => void) | null = null;

    void (async () => {
      unlistenOpenFile = await listen("menu-open-file", async () => {
        await chooseFile();
      });

      unlistenSearch = await listen("menu-search", () => {
        setSearchOpen(true);
      });

      unlistenFileDrop = await listen<string[]>("tauri://drag-drop", async (event) => {
        const paths = event.payload;
        if (paths.length > 0) {
          await loadFile(paths[0]);
        }
      });
    })();

    return () => {
      if (unlistenOpenFile) {
        unlistenOpenFile();
      }
      if (unlistenSearch) {
        unlistenSearch();
      }
      if (unlistenFileDrop) {
        unlistenFileDrop();
      }
    };
  }, []);

  // Keyboard shortcut handler for Cmd+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (isRecordWindow) {
    return <RecordWindowView />;
  }

  if (isEntryWindow) {
    return <EntryWindowView />;
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <Toaster />
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        parsedFile={parsedFile}
        onSelectEntry={(entry) => {
          setSelectedEntry(entry);
          setSelectedRecord(null);
        }}
        onSelectRecord={(record) => {
          setSelectedRecord(record);
        }}
      />
      <div className="grid h-full grid-cols-[300px_1fr]">
        <RecordTree
          filePath={selectedPath}
          fileTree={fileTree}
          selectedRecordId={selectedRecord?.id ?? null}
          selectedEntryId={selectedEntry?.id ?? null}
          onSelectRecord={(record) => {
            setSelectedRecord(record);
            setSelectedEntry(null);
          }}
          onSelectEntry={(entry) => {
            setSelectedEntry(entry);
            setSelectedRecord(null);
          }}
          onOpenRecordWindow={(record) => {
            if (!selectedPath) {
              return;
            }
            openRecordWindow(selectedPath, record);
          }}
          onOpenEntryWindow={(entry) => {
            if (!selectedPath) {
              return;
            }
            openEntryWindow(selectedPath, entry);
          }}
        />

        <section className="h-full overflow-hidden bg-slate-50">
          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          <RecordDetails
            filePath={selectedPath}
            selectedRecord={selectedRecord}
            selectedEntry={selectedEntry}
            onOpenFile={chooseFile}
            onOpenRecordWindow={(record) => {
              if (!selectedPath) {
                return;
              }
              openRecordWindow(selectedPath, record);
            }}
          />
        </section>
      </div>
    </main>
  );
}

export default App;
