# Teams Transcript to Markdown

Converts a Microsoft Teams meeting transcript export (`.docx`) into a structured Markdown note — readable in Obsidian, and easy for an LLM (e.g. Claude) to parse.

## What it does

Teams' "Download transcript" produces a `.docx` where each turn looks like:

```
Walter Sobchak   0:04
okay first order of business is lane reservations for Saturday...
```

This plugin extracts the meeting title, date, and duration from the document header, splits the body into speaker turns, and writes a note like (names and content below are a fictional example, not real meeting data):

```markdown
---
title: "Bowling League Schedule Review"
date: 2026-01-15
source: "Microsoft Teams meeting transcript"
source_file: "Bowling League Schedule Review.docx"
participants:
  - "Walter Sobchak"
  - "Jeffrey Lebowski"
  - "Donny Kerabatsos"
duration: "22m 40s"
tags:
  - "transcript"
  - "meeting"
---

# Bowling League Schedule Review

## Participants
- Walter Sobchak
- Jeffrey Lebowski
- Donny Kerabatsos

## Transcript

**Walter Sobchak** `0:04`
Okay, first order of business is lane reservations for Saturday. I already confirmed with the alley, so that part's locked in.

**Jeffrey Lebowski** `0:18`
Yeah man, whatever works, that's fine with me.

**Donny Kerabatsos** `1:02`
I can bring the extra set of pins we borrowed last time.
```

Each turn is a consistent `**Speaker** \`timestamp\`` line followed by the spoken text — easy to fold/scan in Obsidian, and trivial for Claude (or a regex) to split back into structured turns without heading clutter in a long transcript.

## Install (manual, until this is on the community plugin store)

`main.js` is committed to this repo, so no build step is required to install it.

1. Download this repo (Code → Download ZIP, or `git clone`).
2. Copy the folder into your vault at `<vault>/.obsidian/plugins/teams-transcript-to-markdown/` — it needs `manifest.json` and `main.js` directly inside that folder (not nested one level deeper).
3. In Obsidian: **Settings → Community plugins** → enable **Community plugins** (if prompted) → find **Teams Transcript to Markdown** and toggle it on.

(Or use [BRAT](https://github.com/TfTHacker/obsidian42-brat) and point it at this repo to install/update it automatically instead of copying files by hand.)

If you'd rather build from source:

```bash
npm install
npm run build
```

## Usage

1. Export a transcript from Teams (meeting recap page → **Download transcript**) and drop the `.docx` file anywhere in your vault.
2. Any of the following:
   - Click the ribbon icon (left sidebar) — pick the `.docx` file from the list.
   - Right-click the `.docx` file in the file explorer → **Convert Teams transcript to Markdown** (also works multi-select via **files-menu**).
   - Run the command **Convert Teams transcript (.docx) to Markdown** from the command palette (`Ctrl/Cmd+P`) and pick the file.
3. By default you'll get a prompt to confirm/edit the destination folder and filename (defaults to the `Meetings` folder and `YYYY-MM-DD Meeting Title`, derived from the transcript's own header, not the download filename). Confirm to create the note.

## Settings

- **Output folder** — default `Meetings`. Created automatically if missing. Leave blank for the vault root.
- **Filename template** — default `{{date}} {{title}}`. Supports `{{date}}` (meeting date, `YYYY-MM-DD`) and `{{title}}` (meeting title from the transcript header).
- **Confirm location and filename before converting** — on by default; turn off to skip the prompt and always use the defaults above.
- **Open note after conversion** — on by default.
- **Delete source .docx after conversion** — off by default; moves the original export to the trash once the note is created successfully.
- **Tags** — comma-separated frontmatter tags added to every converted note (default `transcript, meeting`).

## Notes on parsing accuracy

- Turn detection relies on the `Speaker Name` + (2+ spaces) + `timestamp` pattern Teams uses at the start of every turn's paragraph. If a transcript doesn't match (unusual export, heavily edited document), the note is still created with a `> [!warning]` callout instead of silently producing nothing — check the raw text in that case.
- Any header text that couldn't be classified as the title/date/duration is preserved in a `> [!note]` callout at the top of the note rather than being dropped, so nothing gets silently lost.
- Occasional missing spaces mid-sentence (e.g. "we'vebeen") come from Teams' live captioning itself, not from this plugin's parsing — they're preserved as-is from the source transcript.

## Privacy

This plugin runs entirely locally — it never sends transcript content anywhere. That said, converted notes can contain real names and sensitive meeting content, so treat them like any other vault note (mind your sync/sharing settings). When adding examples to this README, an issue, or a PR, please use placeholder names and content rather than real meeting data.

## Development

- `npm run dev` — watch mode (esbuild).
- `npm run build` — production build.
- Source lives in `src/`: `parser.ts` (docx text → structured turns), `formatter.ts` (turns → Markdown), `main.ts` (plugin/UI wiring), `modal.ts` (file picker + destination prompt), `settings.ts`.
