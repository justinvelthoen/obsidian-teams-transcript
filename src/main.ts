import { Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import * as mammoth from "mammoth";
import { ParsedTranscript, parseTranscript } from "./parser";
import { buildMarkdown } from "./formatter";
import { ConvertDestination, ConvertOptionsModal, DocxSuggestModal } from "./modal";
import {
	DEFAULT_SETTINGS,
	TeamsTranscriptSettings,
	TeamsTranscriptSettingTab,
} from "./settings";

function deriveTitleFromFileName(fileName: string): string {
	let name = fileName.replace(/\.docx$/i, "");
	name = name.replace(/[_]+/g, " ");
	name = name.replace(/\s*-\s*transcript\s*$/i, "");
	name = name.replace(/\s+/g, " ").trim();
	return name.length > 0 ? name : "Meeting Transcript";
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "-").trim();
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? "");
}

export default class TeamsTranscriptPlugin extends Plugin {
	settings: TeamsTranscriptSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new TeamsTranscriptSettingTab(this.app, this));

		this.addCommand({
			id: "convert-teams-transcript",
			name: "Convert Teams transcript (.docx) to Markdown",
			callback: () => this.openFilePicker(),
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension.toLowerCase() === "docx") {
					menu.addItem((item) =>
						item
							.setTitle("Convert Teams transcript to Markdown")
							.setIcon("file-text")
							.onClick(() => this.convertFile(file))
					);
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				const docxFiles = files.filter(
					(f): f is TFile => f instanceof TFile && f.extension.toLowerCase() === "docx"
				);
				if (docxFiles.length > 0) {
					menu.addItem((item) =>
						item
							.setTitle(`Convert ${docxFiles.length} Teams transcript(s) to Markdown`)
							.setIcon("file-text")
							.onClick(async () => {
								for (const f of docxFiles) await this.convertFile(f);
							})
					);
				}
			})
		);
	}

	private openFilePicker(): void {
		const docxFiles = this.app.vault
			.getFiles()
			.filter((f) => f.extension.toLowerCase() === "docx");

		if (docxFiles.length === 0) {
			new Notice("No .docx files found in this vault. Add a Teams transcript export first.");
			return;
		}

		new DocxSuggestModal(this.app, docxFiles, (file) => this.convertFile(file)).open();
	}

	async convertFile(file: TFile): Promise<void> {
		let parsed: ParsedTranscript;
		let title: string;
		let date: string;

		try {
			const arrayBuffer = await this.app.vault.readBinary(file);
			const result = await mammoth.extractRawText({ arrayBuffer });

			if (result.messages.some((m) => m.type === "error")) {
				const errors = result.messages
					.filter((m) => m.type === "error")
					.map((m) => m.message)
					.join("; ");
				throw new Error(`mammoth reported errors reading the document: ${errors}`);
			}

			parsed = parseTranscript(result.value);
			title = parsed.meta.title ?? deriveTitleFromFileName(file.basename);
			date = formatDate(parsed.meta.meetingDate ?? new Date(file.stat.ctime));
		} catch (err) {
			console.error("Teams Transcript to Markdown: reading/parsing failed", err);
			new Notice(`Failed to read "${file.name}": ${(err as Error).message}`, 8000);
			return;
		}

		const defaultDest: ConvertDestination = {
			folder: this.settings.outputFolder ? normalizePath(this.settings.outputFolder) : "",
			filename: sanitizeFileName(
				renderTemplate(this.settings.filenameTemplate, { date, title })
			),
		};

		if (this.settings.promptBeforeConvert) {
			await new Promise<void>((resolve) => {
				new ConvertOptionsModal(
					this.app,
					file.path,
					defaultDest,
					async (dest) => {
						await this.finalizeConversion(file, parsed, title, date, dest);
						resolve();
					},
					() => resolve()
				).open();
			});
		} else {
			await this.finalizeConversion(file, parsed, title, date, defaultDest);
		}
	}

	private async finalizeConversion(
		file: TFile,
		parsed: ParsedTranscript,
		title: string,
		date: string,
		dest: ConvertDestination
	): Promise<void> {
		try {
			const tags = this.settings.tags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0);

			const markdown = buildMarkdown(parsed, {
				title,
				date,
				sourceFileName: file.name,
				tags,
				durationText: parsed.meta.durationText,
			});

			const folderPath = dest.folder ? normalizePath(dest.folder) : "";
			await this.ensureFolder(folderPath);

			const destPath = await this.getAvailablePath(folderPath, sanitizeFileName(dest.filename));
			const created = await this.app.vault.create(destPath, markdown);

			if (parsed.turns.length === 0) {
				new Notice(
					`Converted "${file.name}", but no speaker turns were detected. Check "${created.path}" and review the parsing.`,
					8000
				);
			} else {
				new Notice(
					`Converted "${file.name}" -> "${created.path}" (${parsed.turns.length} turns, ${parsed.participants.length} participants).`
				);
			}

			if (this.settings.openAfterConvert) {
				await this.app.workspace.getLeaf(true).openFile(created);
			}

			if (this.settings.deleteSourceAfterConvert) {
				await this.app.vault.trash(file, true);
			}
		} catch (err) {
			console.error("Teams Transcript to Markdown: conversion failed", err);
			new Notice(`Failed to convert "${file.name}": ${(err as Error).message}`, 8000);
		}
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		if (!folderPath) return;
		const existing = this.app.vault.getAbstractFileByPath(folderPath);
		if (existing instanceof TFolder) return;
		if (existing) throw new Error(`"${folderPath}" exists and is not a folder.`);
		await this.app.vault.createFolder(folderPath);
	}

	private async getAvailablePath(folderPath: string, baseName: string): Promise<string> {
		const join = (name: string) => normalizePath(folderPath ? `${folderPath}/${name}.md` : `${name}.md`);

		let candidate = join(baseName);
		let n = 2;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = join(`${baseName} (${n})`);
			n++;
		}
		return candidate;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
