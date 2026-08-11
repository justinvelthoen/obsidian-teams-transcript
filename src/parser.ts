// Parses the raw text extracted from a Teams transcript .docx export into
// structured turns (speaker + timestamp + spoken text).
//
// Real Teams "Download transcript" exports look like this once flattened to
// plain text (paragraphs separated by a blank line):
//
//   <Meeting Title>-20260810_160146-Meeting Recording
//
//   August 10, 2026, 8:01PM
//
//   36m 4s
//
//   Lindsay Karlowsky started transcription
//
//   Lindsay Karlowsky   0:03to some of you or new joiners to this...
//
//   Jim Swanner   4:03Thanks, Lindsay. That sounds like a broken record...
//
// Each turn is a single paragraph: "<Speaker>   <timestamp>" immediately
// followed by the spoken text with no separator (the timestamp and text were
// on separate lines in the original, but a manual line break collapses to
// nothing when flattened to raw text). The speaker name is repeated on every
// turn, even for back-to-back turns from the same person.

export interface TranscriptTurn {
	speaker: string;
	timestamp: string;
	text: string;
}

export interface TranscriptMeta {
	title: string | null;
	meetingDate: Date | null;
	durationText: string | null;
}

export interface ParsedTranscript {
	meta: TranscriptMeta;
	turns: TranscriptTurn[];
	participants: string[];
	preamble: string[];
	firstTimestamp: string | null;
	lastTimestamp: string | null;
}

// Anchored to the start of a paragraph: "Speaker Name" + 2-or-more spaces +
// a timestamp, with the rest of the paragraph (the spoken text) captured
// separately. Two-or-more spaces is what reliably distinguishes the
// name/timestamp preamble from the header lines (dates, durations, etc.),
// which use single spaces.
const TURN_START =
	/^([A-Za-z][\p{L}\p{N}'.,&-]*(?:\s[A-Za-z][\p{L}\p{N}'.,&-]*){0,5})\s{2,}(\d{1,2}(?::\d{2}){1,2})([\s\S]*)$/u;

const DURATION_LINE = /^(?=.*\d)(?:\d+\s*h\s*)?(?:\d+\s*m\s*)?(?:\d+\s*s\s*)?$/i;
const TRANSCRIPTION_MARKER = /(started|stopped) transcription\.?$/i;
const TITLE_SUFFIX = /-\d{8}_\d{6}-Meeting Recording$/i;

function normalizeTimestamp(ts: string): string {
	const parts = ts.split(":").map((p) => p.padStart(2, "0"));
	if (parts.length === 2) return parts.join(":");
	if (parts.length === 3) {
		if (parts[0] === "00") return parts.slice(1).join(":");
		return parts[0].replace(/^0(?=\d)/, "") + ":" + parts.slice(1).join(":");
	}
	return ts;
}

function tryParseDateTime(line: string): Date | null {
	if (!/^[A-Za-z]+\s+\d{1,2},\s*\d{4},?\s*\d{1,2}:\d{2}\s*[AP]M$/i.test(line)) return null;
	const normalized = line.replace(/(\d)(AM|PM)$/i, "$1 $2");
	const date = new Date(normalized);
	return isNaN(date.getTime()) ? null : date;
}

export function parseTranscript(rawText: string): ParsedTranscript {
	const paragraphs = rawText
		.replace(/\r\n?/g, "\n")
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	const turns: TranscriptTurn[] = [];
	const preamble: string[] = [];
	const meta: TranscriptMeta = { title: null, meetingDate: null, durationText: null };

	for (const paragraph of paragraphs) {
		const match = TURN_START.exec(paragraph);
		if (match) {
			turns.push({
				speaker: match[1].trim(),
				timestamp: normalizeTimestamp(match[2]),
				text: match[3].trim(),
			});
			continue;
		}

		if (turns.length > 0) {
			// Trailing paragraphs after the transcript started (e.g. "X stopped
			// transcription") carry no useful content for the note body.
			continue;
		}

		// Still in the header block preceding the first turn.
		if (TRANSCRIPTION_MARKER.test(paragraph)) continue;

		if (DURATION_LINE.test(paragraph)) {
			meta.durationText = paragraph;
			continue;
		}

		const dt = tryParseDateTime(paragraph);
		if (dt) {
			meta.meetingDate = dt;
			continue;
		}

		if (meta.title === null) {
			meta.title = paragraph.replace(TITLE_SUFFIX, "").replace(/\s{2,}/g, " ").trim();
			continue;
		}

		preamble.push(paragraph);
	}

	const participants: string[] = [];
	for (const turn of turns) {
		if (!participants.includes(turn.speaker)) participants.push(turn.speaker);
	}

	return {
		meta,
		turns,
		participants,
		preamble,
		firstTimestamp: turns.length > 0 ? turns[0].timestamp : null,
		lastTimestamp: turns.length > 0 ? turns[turns.length - 1].timestamp : null,
	};
}
