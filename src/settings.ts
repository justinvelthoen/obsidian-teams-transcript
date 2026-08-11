import { App, PluginSettingTab, Setting } from "obsidian";
import type TeamsTranscriptPlugin from "./main";

export interface TeamsTranscriptSettings {
	outputFolder: string; // vault-relative path; empty string = vault root
	filenameTemplate: string; // supports {{date}} and {{title}}
	promptBeforeConvert: boolean;
	openAfterConvert: boolean;
	deleteSourceAfterConvert: boolean;
	tags: string; // comma-separated
}

export const DEFAULT_SETTINGS: TeamsTranscriptSettings = {
	outputFolder: "Meetings",
	filenameTemplate: "{{date}} {{title}}",
	promptBeforeConvert: true,
	openAfterConvert: true,
	deleteSourceAfterConvert: false,
	tags: "transcript, meeting",
};

export class TeamsTranscriptSettingTab extends PluginSettingTab {
	plugin: TeamsTranscriptPlugin;

	constructor(app: App, plugin: TeamsTranscriptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Where converted notes are created, relative to the vault root. Leave blank for the vault root. Created automatically if it doesn't exist.")
			.addText((text) =>
				text
					.setPlaceholder("Meetings")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Filename template")
			.setDesc("Default filename for converted notes. Supports {{date}} (YYYY-MM-DD, from the meeting date) and {{title}} (from the transcript's meeting title).")
			.addText((text) =>
				text
					.setPlaceholder("{{date}} {{title}}")
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate = value.trim() || "{{date}} {{title}}";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Confirm location and filename before converting")
			.setDesc("Show a prompt to review or edit the output folder and filename each time you convert a transcript. Turn off to always use the defaults above without asking.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.promptBeforeConvert).onChange(async (value) => {
					this.plugin.settings.promptBeforeConvert = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Open note after conversion")
			.setDesc("Automatically open the generated Markdown note.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openAfterConvert).onChange(async (value) => {
					this.plugin.settings.openAfterConvert = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Delete source .docx after conversion")
			.setDesc("Removes the original Word file once the Markdown note has been created successfully. Leave off if you want to keep the original export.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.deleteSourceAfterConvert).onChange(async (value) => {
					this.plugin.settings.deleteSourceAfterConvert = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Tags")
			.setDesc("Comma-separated tags added to the frontmatter of every converted note.")
			.addText((text) =>
				text
					.setPlaceholder("transcript, meeting")
					.setValue(this.plugin.settings.tags)
					.onChange(async (value) => {
						this.plugin.settings.tags = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
