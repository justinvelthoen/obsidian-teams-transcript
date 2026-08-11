import type { ParsedTranscript } from "./parser";

export interface FormatOptions {
	title: string;
	date: string; // YYYY-MM-DD
	sourceFileName: string;
	tags: string[];
	durationText?: string | null;
}

function yamlString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlList(values: string[]): string {
	if (values.length === 0) return "[]";
	return "\n" + values.map((v) => `  - ${yamlString(v)}`).join("\n");
}

export function buildMarkdown(parsed: ParsedTranscript, options: FormatOptions): string {
	const { turns, participants, preamble, lastTimestamp } = parsed;
	const duration = options.durationText ?? lastTimestamp ?? "unknown";

	const frontmatter = [
		"---",
		`title: ${yamlString(options.title)}`,
		`date: ${options.date}`,
		`source: ${yamlString("Microsoft Teams meeting transcript")}`,
		`source_file: ${yamlString(options.sourceFileName)}`,
		`participants:${yamlList(participants)}`,
		`duration: ${yamlString(duration)}`,
		`tags:${yamlList(options.tags)}`,
		"---",
		"",
	].join("\n");

	const parts: string[] = [frontmatter, `# ${options.title}`, ""];

	if (participants.length > 0) {
		parts.push("## Participants", "", ...participants.map((p) => `- ${p}`), "");
	}

	if (preamble.length > 0) {
		parts.push(
			"> [!note] Unparsed header content",
			"> The following text appeared before the first recognized speaker turn and may need manual review.",
			...preamble.map((l) => `> ${l}`),
			""
		);
	}

	parts.push("## Transcript", "");

	if (turns.length === 0) {
		parts.push(
			"> [!warning] No speaker turns detected",
			"> This file's structure didn't match the expected `Speaker Name    0:00` pattern. Review the source document, or check the plugin's parsing regex if this is a valid Teams transcript.",
			""
		);
	} else {
		for (const turn of turns) {
			parts.push(`**${turn.speaker}** \`${turn.timestamp}\``, turn.text, "");
		}
	}

	return parts.join("\n").trimEnd() + "\n";
}
