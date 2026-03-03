# MineX9

Cross-platform desktop skeleton for parsing and validating X9.37 files.

## Stack

- Tauri 2 (desktop runtime and packaging)
- Rust (core parsing engine)
- React + TypeScript + Vite + Tailwind CSS (frontend)

## Project Layout

- `src/components`: reusable UI pieces
- `src/features/x937`: frontend modules for X9.37 workflows
- `src-tauri/src/commands`: Tauri invoke commands exposed to the frontend
- `src-tauri/src/parser`: Rust parser modules and record handling

## Current Milestone

- File picker wired through Tauri dialog plugin
- `parse_x937_file` command implemented in Rust
- Automatic decode path for UTF-8 and EBCDIC (IBM037) records before field parsing
- Left-side collapsible explorer grouped by file headers, batch headers, entries, and footers
- Entry grouping combines check detail + addenda + image detail/data into single sidebar items
- Open files from File menu (`Cmd/Ctrl+O`)
- Image View Data (52) records can be decoded and rendered in the detail panel

## Local Development

1. Install prerequisites for Tauri and Rust: <https://tauri.app/start/prerequisites/>
2. Install JS dependencies:

```bash
npm install
```

3. Run desktop app:

```bash
npm run tauri dev
```
