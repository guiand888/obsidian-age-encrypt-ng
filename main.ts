import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	TFile
} from 'obsidian';

// HTMLElement should be used directly from lib.dom
type HTMLElementType = HTMLElement;

import { EncryptionService } from './src/services/encryption';
import { AgeEncryptSettings, DEFAULT_SETTINGS } from './src/settings';
import { PasswordModal } from './src/ui/PasswordModal';

export default class AgeEncryptPlugin extends Plugin {
	private settings: AgeEncryptSettings;
	private encryptionService: EncryptionService;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.encryptionService = new EncryptionService();

		// Register the markdown processor for encrypted blocks
		this.registerMarkdownCodeBlockProcessor('age', async (
			source: string,
			el: HTMLElementType,
			ctx: MarkdownPostProcessorContext
		) => {
			try {
				const { content, hint } = this.encryptionService.parseEncryptedBlock(source);
				const decryptButton = el.createEl('button', {
					cls: 'age-encrypt-decrypt-button',
					attr: { 'aria-label': 'Decrypt encrypted content' }
				});

				// Create content container inside button
				const contentContainer = decryptButton.createDiv({
					cls: 'age-encrypt-decrypt-content'
				});

				// Add main text
				contentContainer.createDiv({
					cls: 'age-encrypt-decrypt-title',
					text: 'Encrypted content'
				});

				// Add info text
				const infoContainer = contentContainer.createDiv({
					cls: 'age-encrypt-decrypt-info'
				});

				infoContainer.createSpan({
					text: 'Click to decrypt'
				});

				if (hint) {
					infoContainer.createSpan({
						cls: 'age-encrypt-hint',
						text: `• Hint: ${hint}`
					});
				}

				// Add encryption type info
				infoContainer.createSpan({
					cls: 'age-encrypt-type',
					text: '• Encrypted with age'
				});

				decryptButton.onclick = async () => {
					let password: string | undefined;
					let rememberPassword = false;
					
					if (this.encryptionService.hasStoredPassword(content)) {
						password = this.encryptionService.getStoredPassword(content);
						rememberPassword = true;
					} else {
						const result = await new PasswordModal(this.app, false, hint)
							.openAndGetPassword();
						if (!result) return;
						password = result.password;
						rememberPassword = result.remember || false;
					}

					try {
						const decrypted = await this.encryptionService.decrypt(content, password!);
						el.empty();
						
						// Calculate number of lines in decrypted text
						const lineCount = decrypted.split('\n').length;
						const height = lineCount * 22 + 16;
						
						// Create editable textarea with dynamic height
						const textarea = el.createEl('textarea', {
							text: decrypted,
							cls: 'age-encrypt-textarea'
						});
						
						// Set initial height and font size
						textarea.style.height = `${height}px`;
						
						// Create button container
						const buttonContainer = el.createDiv({
							cls: 'age-encrypt-button-container'
						});

						// Create save encrypted button
						const saveEncryptedButton = buttonContainer.createEl('button', {
							text: 'Save encrypted',
							cls: 'age-encrypt-button'
						});

						// Create save as plain text button
						const savePlainTextButton = buttonContainer.createEl('button', {
							text: 'Save as plain text',
							cls: 'age-encrypt-button age-encrypt-button-secondary'
						});

						// Get file and position information
						const file = this.app.workspace.getActiveFile();
						const startLine = ctx.getSectionInfo(el)?.lineStart || 0;
						const endLine = ctx.getSectionInfo(el)?.lineEnd || 0;

						saveEncryptedButton.onclick = async () => {
							try {
								const editedContent = textarea.value;
								const encrypted = await this.encryptionService.encrypt(editedContent, {
									password: password!,
									hint: hint,
									remember: rememberPassword
								});
								const formattedBlock = this.encryptionService.formatEncryptedBlock(
									encrypted,
									hint
								);
								
								await this.updateFileContent(file, startLine, endLine, formattedBlock);
								new Notice('Content re-encrypted successfully');
							} catch (error) {
								new Notice('Failed to re-encrypt content');
							}
						};

						savePlainTextButton.onclick = async () => {
							try {
								const editedContent = textarea.value;
								await this.updateFileContent(file, startLine, endLine, editedContent);
								new Notice('Saved as plain text');
							} catch (error) {
								new Notice('Failed to save as plain text');
							}
						};
					} catch (error) {
						new Notice('Failed to decrypt content');
					}
				};
			} catch (error) {
				console.error('Failed to process age codeblock:', error);
				el.createDiv({ text: 'Invalid encrypted content' });
			}
		});

		// Add command to encrypt selection
		this.addCommand({
			id: 'encrypt-selection',
			name: 'Encrypt selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}

				const modal = new PasswordModal(this.app, true);
				const result = await modal.openAndGetPassword();
				
				if (!result) return;

				try {
					const encrypted = await this.encryptionService.encrypt(selection, {
						password: result.password,
						hint: result.hint,
						remember: result.remember
					});
					const formattedBlock = this.encryptionService.formatEncryptedBlock(
						encrypted,
						result.hint
					);
					editor.replaceSelection(formattedBlock);
				} catch (error) {
					new Notice('Failed to encrypt content');
				}
			}
		});

		// Add command to encrypt entire file
		this.addCommand({
			id: 'encrypt-file',
			name: 'Encrypt file',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file');
					return;
				}

				const content = await this.app.vault.read(activeFile);
				const modal = new PasswordModal(this.app, true);
				const result = await modal.openAndGetPassword();
				
				if (!result) return;

				try {
					const encrypted = await this.encryptionService.encrypt(content, {
						password: result.password,
						hint: result.hint,
						remember: result.remember
					});
					const formattedBlock = this.encryptionService.formatEncryptedBlock(
						encrypted,
						result.hint
					);
					await this.app.vault.modify(activeFile, formattedBlock);
					new Notice('File encrypted successfully');
				} catch (error) {
					new Notice('Failed to encrypt file');
				}
			}
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {
		this.encryptionService.clearStoredPasswords();
	}

	// Helper method to update file content
	private async updateFileContent(
		file: TFile | null,
		startLine: number,
		endLine: number,
		newContent: string
	): Promise<void> {
		if (!file) return;
		
		const fileContent = await this.app.vault.read(file);
		const lines = fileContent.split('\n');
		lines.splice(startLine, endLine - startLine + 1, newContent);
		await this.app.vault.modify(file, lines.join('\n'));
	}
}
