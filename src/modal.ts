import { App, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";

export class DocxSuggestModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChoose: (file: TFile) => void;

	constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onChoose = onChoose;
		this.setPlaceholder("Choose a Teams transcript (.docx) to convert");
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}

export interface ConvertDestination {
	folder: string;
	filename: string; // without .md extension
}

export class ConvertOptionsModal extends Modal {
	private folder: string;
	private filename: string;
	private sourceLabel: string;
	private onSubmit: (dest: ConvertDestination) => void;
	private onCancel: () => void;
	private submitted = false;
	private previewEl: HTMLElement;

	constructor(
		app: App,
		sourceLabel: string,
		defaults: ConvertDestination,
		onSubmit: (dest: ConvertDestination) => void,
		onCancel: () => void = () => {}
	) {
		super(app);
		this.sourceLabel = sourceLabel;
		this.folder = defaults.folder;
		this.filename = defaults.filename;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Convert Teams transcript to Markdown" });
		contentEl.createEl("p", {
			text: `Source: ${this.sourceLabel}`,
			cls: "setting-item-description",
		});

		new Setting(contentEl)
			.setName("Folder")
			.setDesc("Vault-relative path. Leave blank for the vault root; created automatically if it doesn't exist.")
			.addText((text) =>
				text
					.setPlaceholder("Meetings")
					.setValue(this.folder)
					.onChange((value) => {
						this.folder = value.trim();
						this.updatePreview();
					})
			);

		new Setting(contentEl).setName("Filename").addText((text) =>
			text
				.setValue(this.filename)
				.onChange((value) => {
					this.filename = value.trim();
					this.updatePreview();
				})
		);

		this.previewEl = contentEl.createEl("p", { cls: "setting-item-description" });
		this.updatePreview();

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Convert")
					.setCta()
					.onClick(() => {
						if (!this.filename) {
							this.filename = "Untitled Meeting";
						}
						this.submitted = true;
						this.close();
						this.onSubmit({ folder: this.folder, filename: this.filename });
					})
			)
			.addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
	}

	private updatePreview(): void {
		const path = this.folder ? `${this.folder}/${this.filename}.md` : `${this.filename}.md`;
		this.previewEl.setText(`Will create: ${path}`);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) this.onCancel();
	}
}
