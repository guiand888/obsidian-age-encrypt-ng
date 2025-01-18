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
		console.log('Loading Age Encrypt plugin...');
		
		await this.loadSettings();
		console.log('Settings loaded');

		this.encryptionService = new EncryptionService();
		console.log('Encryption service initialized');

		// Register the markdown processor for encrypted blocks
		this.registerMarkdownCodeBlockProcessor('age', async (
			source: string,
			el: HTMLElementType,
			ctx: MarkdownPostProcessorContext
		) => {
			console.log('Processing age codeblock');
			try {
				const { content, hint } = this.encryptionService.parseEncryptedBlock(source);
				console.log('Parsed encrypted block', { hasHint: !!hint });
				const decryptButton = el.createEl('button', {
					cls: 'age-encrypt-button',
					text: 'Decrypt Content'
				});

				if (hint) {
					decryptButton.createSpan({
						cls: 'age-encrypt-hint',
						text: `(Hint: ${hint})`
					});
				}

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
						
						// Create editable textarea
						const textarea = el.createEl('textarea', {
							text: decrypted,
							cls: 'age-encrypt-textarea'
						});
						
						// Create button container
						const buttonContainer = el.createDiv({
							cls: 'age-encrypt-button-container'
						});

						// Create save encrypted button
						const saveEncryptedButton = buttonContainer.createEl('button', {
							text: 'Save Encrypted',
							cls: 'age-encrypt-button'
						});

						// Create save as plain text button
						const savePlainTextButton = buttonContainer.createEl('button', {
							text: 'Save as Plain Text',
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
			name: 'Encrypt Selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				console.log('Encrypting selection...');
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
			name: 'Encrypt File',
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

		console.log('Age Encrypt plugin loaded successfully');
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {
		console.log('Unloading Age Encrypt plugin...');
		this.encryptionService.clearStoredPasswords();
		console.log('Session passwords cleared');
		console.log('Age Encrypt plugin unloaded');
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
