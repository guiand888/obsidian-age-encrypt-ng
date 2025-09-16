import { Modal, App, Setting, Notice } from 'obsidian';

export interface KeyFileUnlockRequest {
    filePath: string;
    displayName?: string; // Optional friendly name for display
}

export interface KeyFileUnlockResult {
    filePath: string;
    passphrase: string;
    success: boolean;
    remember?: boolean;  // Whether to remember this passphrase
    error?: string;
}

export interface KeyFilePasswordResult {
    results: KeyFileUnlockResult[];
    cancelled: boolean;
}

export class KeyFilePasswordModal extends Modal {
    private keyFiles: KeyFileUnlockRequest[];
    private currentIndex: number = 0;
    private results: KeyFileUnlockResult[] = [];
    private currentPassphrase: string = '';
    private rememberPassphrase: boolean = false;
    private resolve: (value: KeyFilePasswordResult) => void;
    private errorEl: HTMLElement | null = null;

    constructor(
        app: App,
        keyFiles: KeyFileUnlockRequest[]
    ) {
        super(app);
        this.keyFiles = keyFiles.filter(kf => kf.filePath); // Ensure valid entries
        if (this.keyFiles.length === 0) {
            throw new Error('No key files provided to unlock');
        }
    }

    async openAndUnlockKeyFiles(): Promise<KeyFilePasswordResult> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen(): void {
        this.currentIndex = 0;
        this.results = [];
        this.displayCurrentKeyFile();
    }

    private displayCurrentKeyFile(): void {
        const { contentEl } = this;
        contentEl.empty();
        
        const currentKeyFile = this.keyFiles[this.currentIndex];
        const progress = `${this.currentIndex + 1} of ${this.keyFiles.length}`;
        
        contentEl.createEl('h2', { text: 'Unlock Key File' });
        
        contentEl.createEl('p', {
            text: `Unlocking key files (${progress})`,
            cls: 'setting-item-description'
        });

        // Show current key file info
        const keyFileInfo = contentEl.createDiv({ cls: 'age-encrypt-keyfile-info' });
        keyFileInfo.createEl('h3', { 
            text: currentKeyFile.displayName || currentKeyFile.filePath.split('/').pop() || currentKeyFile.filePath 
        });
        keyFileInfo.createEl('p', { 
            text: `Path: ${currentKeyFile.filePath}`,
            cls: 'age-encrypt-keyfile-path' 
        });

        const clearError = () => {
            if (this.errorEl) {
                this.errorEl.remove();
                this.errorEl = null;
            }
        };

        const showError = (message: string) => {
            clearError();
            this.errorEl = contentEl.createEl('p', {
                text: message,
                cls: 'age-encrypt-error'
            });
            this.errorEl.style.color = 'var(--text-error)';
            this.errorEl.style.marginTop = '1em';
        };

        // Password input
        const passwordSetting = new Setting(contentEl)
            .setName('Key file passphrase')
            .setDesc('Enter the passphrase to decrypt this key file')
            .addText(text => {
                text
                    .setPlaceholder('Enter passphrase')
                    .setValue(this.currentPassphrase)
                    .onChange(value => this.currentPassphrase = value);
                text.inputEl.type = 'password';
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.tryUnlockCurrent(showError, clearError);
                    }
                });
                // Focus the input
                setTimeout(() => text.inputEl.focus(), 100);
                return text;
            });

        // Remember passphrase option
        new Setting(contentEl)
            .setName('Remember for this session')
            .setDesc('Keep this key file unlocked until Obsidian is closed')
            .addToggle(toggle => toggle
                .setValue(this.rememberPassphrase)
                .onChange(value => this.rememberPassphrase = value));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'age-encrypt-button-container' });
        
        const unlockButton = buttonContainer.createEl('button', {
            text: 'Unlock',
            cls: 'mod-cta'
        });
        
        const skipButton = buttonContainer.createEl('button', {
            text: 'Skip'
        });
        
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel All'
        });

        unlockButton.onclick = () => this.tryUnlockCurrent(showError, clearError);
        skipButton.onclick = () => this.skipCurrent();
        cancelButton.onclick = () => this.cancelAll();

        // Show progress if multiple files
        if (this.keyFiles.length > 1) {
            const progressDiv = contentEl.createDiv({ cls: 'age-encrypt-progress' });
            progressDiv.createEl('p', {
                text: `Progress: ${this.currentIndex + 1}/${this.keyFiles.length} key files`,
                cls: 'age-encrypt-progress-text'
            });
            
            // Show which files have been processed
            if (this.currentIndex > 0) {
                const completedDiv = progressDiv.createDiv({ cls: 'age-encrypt-completed-files' });
                const successful = this.results.filter(r => r.success).length;
                const failed = this.results.filter(r => !r.success).length;
                completedDiv.createEl('p', {
                    text: `Completed: ${successful} successful, ${failed} failed`,
                    cls: 'setting-item-description'
                });
            }
        }
    }

    private async tryUnlockCurrent(showError: (msg: string) => void, clearError: () => void): Promise<void> {
        clearError();
        
        if (!this.currentPassphrase.trim()) {
            showError('Please enter a passphrase');
            return;
        }

        const currentKeyFile = this.keyFiles[this.currentIndex];
        
        try {
            // Import KeyFileService here to avoid circular dependencies
            const keyFileService = (this.app as any).plugins?.plugins?.['age-encrypt']?.encryptionService?.getKeyFileService();
            if (!keyFileService) {
                throw new Error('Key file service not available');
            }

            // Try to decrypt the key file
            const identities = await keyFileService.decryptKeyFile(currentKeyFile.filePath, this.currentPassphrase);
            
            if (identities.length === 0) {
                throw new Error('No valid identities found in key file');
            }

            // Success!
            this.results.push({
                filePath: currentKeyFile.filePath,
                passphrase: this.currentPassphrase,
                success: true,
                remember: this.rememberPassphrase
            });

            new Notice(`✓ Key file unlocked: ${currentKeyFile.displayName || currentKeyFile.filePath.split('/').pop()}`);
            this.moveToNext();
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to unlock key file';
            showError(errorMessage);
            
            // Record the failure but don't automatically move on
            this.results[this.currentIndex] = {
                filePath: currentKeyFile.filePath,
                passphrase: this.currentPassphrase,
                success: false,
                remember: this.rememberPassphrase,
                error: errorMessage
            };
        }
    }

    private skipCurrent(): void {
        const currentKeyFile = this.keyFiles[this.currentIndex];
        this.results.push({
            filePath: currentKeyFile.filePath,
            passphrase: '',
            success: false,
            remember: false,
            error: 'Skipped by user'
        });
        
        this.moveToNext();
    }

    private moveToNext(): void {
        this.currentIndex++;
        this.currentPassphrase = ''; // Reset for next file
        this.rememberPassphrase = false; // Reset remember flag for next file
        
        if (this.currentIndex >= this.keyFiles.length) {
            // All done
            this.resolve({
                results: this.results,
                cancelled: false
            });
            this.close();
        } else {
            // Show next file
            this.displayCurrentKeyFile();
        }
    }

    private cancelAll(): void {
        this.resolve({
            results: this.results, // Return whatever we've processed so far
            cancelled: true
        });
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}