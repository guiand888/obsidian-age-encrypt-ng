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
import { AgeEncryptSettingTab } from './src/ui/SettingsTab';
import { PasswordModal } from './src/ui/PasswordModal';
import { EncryptionModeModal, EncryptionMode } from './src/ui/EncryptionModeModal';
import { KeyFilePasswordModal, KeyFileUnlockRequest } from './src/ui/KeyFilePasswordModal';

export default class AgeEncryptPlugin extends Plugin {
	settings: AgeEncryptSettings;
	encryptionService: EncryptionService;

	async onload(): Promise<void> {
	await this.loadSettings();
	this.addSettingTab(new AgeEncryptSettingTab(this.app, this));
	this.encryptionService = new EncryptionService();
	// Initialize encryption service with app instance for key file support
	this.encryptionService.init(this.app);

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
				await this.decryptContent(el, content, hint, ctx);
			};
			} catch (error) {
				console.error('Failed to process age codeblock:', error);
				el.createDiv({ text: 'Invalid encrypted content' });
			}
		});

		// Auto mode commands (respect settings)
		this.addCommand({
			id: 'encrypt-selection',
			name: 'Encrypt selection (auto)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}

				await this.encryptSelection(editor, selection);
			}
		});

		// Explicit passphrase commands
		this.addCommand({
			id: 'encrypt-selection-passphrase',
			name: 'Encrypt selection (with passphrase)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}

				await this.encryptSelection(editor, selection, 'passphrase');
			}
		});

		// Explicit key files commands
		this.addCommand({
			id: 'encrypt-selection-keyfiles',
			name: 'Encrypt selection (with key files)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}

				await this.encryptSelection(editor, selection, 'keyfiles');
			}
		});

		// Auto mode file commands
		this.addCommand({
			id: 'encrypt-file',
			name: 'Encrypt file (auto)',
			callback: async () => {
				await this.encryptFile();
			}
		});

		// Explicit file encryption commands
		this.addCommand({
			id: 'encrypt-file-passphrase',
			name: 'Encrypt file (with passphrase)',
			callback: async () => {
				await this.encryptFile('passphrase');
			}
		});

		this.addCommand({
			id: 'encrypt-file-keyfiles',
			name: 'Encrypt file (with key files)',
			callback: async () => {
				await this.encryptFile('keyfiles');
			}
		});

		// Utility command to clear all cached data
		this.addCommand({
			id: 'clear-all-cached-data',
			name: 'Clear all remembered passphrases and key files',
			callback: async () => {
				await this.clearAllCachedData();
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
		this.encryptionService.clearAllCaches();
	}

	// Helper method to update file content
	private async updateFileContent(
		file: TFile | null,
		startLine: number,
		endLine: number,
		newContent: string
	): Promise<void> {
		if (!file) return;

		const fileContent = await this.app.vault.process(file, (data) => {
			const lines = data.split('\n');
			lines.splice(startLine, endLine - startLine + 1, newContent);
			return lines.join('\n');
		});
	}

	// Comprehensive encryption method for selections
	private async encryptSelection(
		editor: Editor, 
		selection: string, 
		forceMode?: EncryptionMode
	): Promise<void> {
		try {
			const mode = await this.determineEncryptionMode(forceMode, true);
			if (!mode) return; // User cancelled

			const encryptionOptions = await this.getEncryptionOptions(mode);
			if (!encryptionOptions) return; // User cancelled

			const encrypted = await this.encryptionService.encryptWithMode(
				selection, 
				mode, 
				encryptionOptions
			);
			
			const formattedBlock = this.encryptionService.formatEncryptedBlock(
				encrypted,
				encryptionOptions.hint
			);

			const endOfSelection = editor.posToOffset(editor.getCursor('to'));
			const endOfFile = editor.getValue().length;

			let finalBlock = formattedBlock;
			if (endOfSelection === endOfFile) {
				finalBlock += '\n';
			}

			editor.replaceSelection(finalBlock);
			new Notice(`Selection encrypted using ${mode === 'keyfiles' ? 'key files' : 'passphrase'}`);
		} catch (error) {
			console.error('Encryption failed:', error);
			new Notice(`Failed to encrypt content: ${error.message}`);
		}
	}

	// Comprehensive encryption method for files
	private async encryptFile(forceMode?: EncryptionMode): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		try {
			const mode = await this.determineEncryptionMode(forceMode, true);
			if (!mode) return; // User cancelled

			const encryptionOptions = await this.getEncryptionOptions(mode);
			if (!encryptionOptions) return; // User cancelled

			const fileContent = await this.app.vault.read(activeFile);
			let contentToEncrypt = fileContent.trimEnd();
			let frontmatter = '';

			if (this.settings.excludeFrontmatter) {
				const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
				const match = fileContent.match(frontmatterRegex);
				if (match) {
					frontmatter = match[0];
					contentToEncrypt = fileContent.substring(frontmatter.length).trimEnd();
				}
			}

			const encrypted = await this.encryptionService.encryptWithMode(
				contentToEncrypt,
				mode,
				encryptionOptions
			);

			const formattedBlock = this.encryptionService.formatEncryptedBlock(
				encrypted,
				encryptionOptions.hint
			);

			let finalContent = frontmatter + formattedBlock;
			if (contentToEncrypt.length > 0 && !contentToEncrypt.endsWith('\n')) {
				finalContent += '\n';
			}

			await this.app.vault.modify(activeFile, finalContent);
			new Notice(`File encrypted using ${mode === 'keyfiles' ? 'key files' : 'passphrase'}`);
		} catch (error) {
			console.error('File encryption failed:', error);
			new Notice(`Failed to encrypt file: ${error.message}`);
		}
	}

	// Determine which encryption mode to use
	private async determineEncryptionMode(
		forceMode?: EncryptionMode,
		isEncrypting: boolean = true
	): Promise<EncryptionMode | null> {
		// If mode is forced, use it
		if (forceMode) {
			return forceMode;
		}

		// Check session override
		const sessionMode = this.encryptionService.getSessionEncryptionMode();
		if (sessionMode) {
			return sessionMode;
		}

		// Check settings mode
		if (this.settings.encryptionMode === 'passphrase') {
			return 'passphrase';
		} else if (this.settings.encryptionMode === 'keyfiles') {
			// Validate that key files mode is properly configured
			const validation = this.encryptionService.validateModeConfiguration(
				'keyfiles', 
				this.settings.keyFiles, 
				this.settings.recipients
			);
			
			if (!validation.valid) {
				new Notice(`Key files mode configuration error: ${validation.error}`);
				return 'passphrase'; // Fallback to passphrase
			}
			
			return 'keyfiles';
		} else {
			// Mixed mode - ask user
				const modeModal = new EncryptionModeModal(this.app, isEncrypting, this.settings.defaultRememberSession);
				const result = await modeModal.openAndGetMode();
			
			if (!result) return null;
			
			// Remember session choice if requested
			if (result.remember) {
				this.encryptionService.setSessionEncryptionMode(result.mode);
			}
			
			return result.mode;
		}
	}

	// Get encryption options based on mode
	private async getEncryptionOptions(mode: EncryptionMode): Promise<{
		password?: string;
		hint?: string;
		remember?: boolean;
		keyFilePaths?: string[];
		recipients?: string[];
	} | null> {
		if (mode === 'passphrase') {
			const modal = new PasswordModal(this.app, true, undefined, this.settings.defaultRememberSession);
			const result = await modal.openAndGetPassword();
			return result;
		} else {
			// Key files mode
			const keyFilesToUnlock = this.settings.keyFiles.filter(kf => {
				const keyFileService = this.encryptionService.getKeyFileService();
				return !keyFileService?.getCachedIdentity(kf);
			});

			// If we have locked key files, unlock them
			if (keyFilesToUnlock.length > 0) {
				const unlockRequests: KeyFileUnlockRequest[] = keyFilesToUnlock.map(kf => ({
					filePath: kf,
					displayName: kf.split('/').pop()
				}));

				const keyFileModal = new KeyFilePasswordModal(this.app, unlockRequests, this.settings.defaultRememberSession);
				const unlockResult = await keyFileModal.openAndUnlockKeyFiles();
				
				if (unlockResult.cancelled) {
					return null;
				}

				const successful = unlockResult.results.filter(r => r.success);
				if (successful.length === 0) {
					new Notice('No key files were successfully unlocked');
					return null;
				}
			}

			// Use default hint if available
			const hint = this.settings.defaultHint;

			return {
				keyFilePaths: this.settings.keyFiles,
				recipients: this.settings.recipients,
				hint
			};
		}
	}

	// Comprehensive decryption method with intelligent fallback
	private async decryptContent(
		el: HTMLElement,
		encryptedContent: string,
		hint?: string,
		ctx?: MarkdownPostProcessorContext
	): Promise<void> {
		try {
			// Try intelligent decryption first (cached methods)
			try {
				const result = await this.encryptionService.decryptIntelligent(
					encryptedContent,
					this.settings.keyFiles,
					this.settings.recipients
				);
				
				// Success with cached methods
				await this.showDecryptedContent(
					el, 
					result.decryptedContent, 
					hint, 
					ctx, 
					result.method
				);
				return;
			} catch (error) {
				// Cached methods failed, need user intervention
				console.log('Intelligent decryption failed, prompting user:', error.message);
			}

			// Determine decryption mode based on settings and session
			const mode = await this.determineEncryptionMode(undefined, false);
			if (!mode) return; // User cancelled

			let decryptedContent: string;
			let decryptionMethod: string;

			if (mode === 'passphrase') {
				// Use passphrase decryption
				const modal = new PasswordModal(this.app, false, hint, this.settings.defaultRememberSession);
				const result = await modal.openAndGetPassword();
				if (!result) return;

				decryptedContent = await this.encryptionService.decrypt(encryptedContent, result.password);
				decryptionMethod = 'passphrase';

				// Store password for session if requested
				if (result.remember) {
					// Store the password in the session cache
					this.encryptionService['sessionPasswords'].set(encryptedContent, result.password);
				}
			} else {
				// Use key files decryption
				const keyFilesToUnlock = this.settings.keyFiles.filter(kf => {
					const keyFileService = this.encryptionService.getKeyFileService();
					return !keyFileService?.getCachedIdentity(kf);
				});

				// Unlock key files if needed
				if (keyFilesToUnlock.length > 0) {
					const unlockRequests: KeyFileUnlockRequest[] = keyFilesToUnlock.map(kf => ({
						filePath: kf,
						displayName: kf.split('/').pop()
					}));

					const keyFileModal = new KeyFilePasswordModal(this.app, unlockRequests, this.settings.defaultRememberSession);
					const unlockResult = await keyFileModal.openAndUnlockKeyFiles();
					
					if (unlockResult.cancelled) {
						return;
					}

					const successful = unlockResult.results.filter(r => r.success);
					if (successful.length === 0) {
						new Notice('No key files were successfully unlocked');
						return;
					}
				}

				// Try decryption with available identities
				const keyFileService = this.encryptionService.getKeyFileService()!;
				const identities: string[] = [];
				const usedKeyFiles: string[] = [];

				for (const keyFile of this.settings.keyFiles) {
					const cached = keyFileService.getCachedIdentity(keyFile);
					if (cached?.identity) {
						identities.push(cached.identity);
						usedKeyFiles.push(keyFile);
					}
				}

				if (identities.length === 0) {
					new Notice('No unlocked key files available for decryption');
					return;
				}

				decryptedContent = await this.encryptionService.decryptWithOptions(encryptedContent, {
					identities
				});
				decryptionMethod = `keyfiles(${usedKeyFiles.length})`;
			}

			// Show decrypted content
			await this.showDecryptedContent(el, decryptedContent, hint, ctx, decryptionMethod);

		} catch (error) {
			console.error('Decryption failed:', error);
			new Notice(`Failed to decrypt content: ${error.message}`);
		}
	}

	// Show decrypted content with edit interface
	private async showDecryptedContent(
		el: HTMLElement,
		decryptedContent: string,
		hint?: string,
		ctx?: MarkdownPostProcessorContext,
		decryptionMethod?: string
	): Promise<void> {
		el.empty();

		// Show decryption method info
		if (decryptionMethod) {
			const methodInfo = el.createDiv({ cls: 'age-encrypt-method-info' });
			methodInfo.createSpan({ 
				text: `Decrypted using: ${decryptionMethod.replace('_', ' ')}`,
				cls: 'age-encrypt-method-text'
			});
		}

		// Calculate number of lines in decrypted text
		const lineCount = decryptedContent.split('\n').length;
		const height = lineCount * 22 + 16;

		// Create editable textarea with dynamic height
		const textarea = el.createEl('textarea', {
			text: decryptedContent,
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
		const startLine = ctx?.getSectionInfo(el)?.lineStart || 0;
		const endLine = ctx?.getSectionInfo(el)?.lineEnd || 0;

		saveEncryptedButton.onclick = async () => {
			try {
				const editedContent = textarea.value;
				
				// Determine encryption mode for re-encryption
				const mode = await this.determineEncryptionMode(undefined, true);
				if (!mode) return;

				const encryptionOptions = await this.getEncryptionOptions(mode);
				if (!encryptionOptions) return;

				const encrypted = await this.encryptionService.encryptWithMode(
					editedContent,
					mode,
					encryptionOptions
				);
				
				const formattedBlock = this.encryptionService.formatEncryptedBlock(
					encrypted,
					encryptionOptions.hint || hint
				);

				await this.updateFileContent(file, startLine, endLine, formattedBlock);
				new Notice(`Content re-encrypted using ${mode === 'keyfiles' ? 'key files' : 'passphrase'}`);
			} catch (error) {
				console.error('Re-encryption failed:', error);
				new Notice(`Failed to re-encrypt content: ${error.message}`);
			}
		};

		savePlainTextButton.onclick = async () => {
			try {
				const editedContent = textarea.value;
				await this.updateFileContent(file, startLine, endLine, editedContent);
				new Notice('Saved as plain text');
			} catch (error) {
				console.error('Save as plain text failed:', error);
				new Notice(`Failed to save as plain text: ${error.message}`);
			}
		};
	}

	// Clear all cached passphrases and key files
	private async clearAllCachedData(): Promise<void> {
		try {
			// Get counts before clearing for user feedback
			const keyFileService = this.encryptionService.getKeyFileService();
			const keyFileCount = keyFileService ? keyFileService.getAllCachedIdentities().length : 0;
			const sessionPasswordCount = this.encryptionService['sessionPasswords'].size;
			const hasSessionMode = this.encryptionService.getSessionEncryptionMode() !== undefined;
			
			// Clear all session data from encryption service
			this.encryptionService.clearAllCaches();
			
			const clearedItems: string[] = [];
			if (sessionPasswordCount > 0) clearedItems.push(`${sessionPasswordCount} session password(s)`);
			if (keyFileCount > 0) clearedItems.push(`${keyFileCount} unlocked key file(s)`);
			if (hasSessionMode) clearedItems.push('session encryption mode preference');
			
			if (clearedItems.length > 0) {
				new Notice(`Cleared cached data:\n- ${clearedItems.join('\n- ')}`);
			} else {
				new Notice('No cached data to clear');
			}
		} catch (error) {
			console.error('Failed to clear cached data:', error);
			new Notice('Failed to clear some cached data. Check console for details.');
		}
	}
}
