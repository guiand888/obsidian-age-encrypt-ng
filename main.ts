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
					
					if (this.encryptionService.hasStoredPassword(content)) {
						password = this.encryptionService.getStoredPassword(content);
					} else {
						const result = await new PasswordModal(this.app, false, hint)
							.openAndGetPassword();
						if (!result) return;
						password = result.password;
					}

					try {
						const decrypted = await this.encryptionService.decrypt(content, password!);
						el.empty();
						el.createDiv({ text: decrypted });
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
}
