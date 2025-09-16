import { Modal, App, Setting } from 'obsidian';

export type EncryptionMode = 'keyfiles' | 'passphrase';

export interface EncryptionModeResult {
    mode: EncryptionMode;
    remember?: boolean; // Whether to remember this choice for the session
}

export class EncryptionModeModal extends Modal {
    private selectedMode: EncryptionMode = 'passphrase';
    private rememberChoice: boolean = false;
    private resolve: (value: EncryptionModeResult | null) => void;
    private isEncrypting: boolean;

    constructor(
        app: App,
        isEncrypting: boolean = true,
        defaultRemember: boolean = false,
        suggestedMode?: EncryptionMode
    ) {
        super(app);
        this.isEncrypting = isEncrypting;
        this.rememberChoice = defaultRemember;
        // Use suggested mode if provided, otherwise default to passphrase
        this.selectedMode = suggestedMode || 'passphrase';
    }

    async openAndGetMode(): Promise<EncryptionModeResult | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { 
            text: this.isEncrypting ? 'Choose encryption method' : 'Choose decryption method' 
        });

        contentEl.createEl('p', {
            text: this.isEncrypting 
                ? 'How would you like to encrypt this content?'
                : 'How would you like to decrypt this content?',
            cls: 'setting-item-description'
        });

        // Mode selection
        new Setting(contentEl)
            .setName('Method')
            .setDesc('Choose between using key files or a passphrase')
            .addDropdown(dropdown => dropdown
                .addOption('passphrase', 'Passphrase')
                .addOption('keyfiles', 'Key Files')
                .setValue(this.selectedMode)
                .onChange((value: EncryptionMode) => {
                    this.selectedMode = value;
                }));

        // Show additional info based on selected mode
        const infoContainer = contentEl.createDiv({ cls: 'age-encrypt-mode-info' });
        this.updateModeInfo(infoContainer);

        // Remember choice option
        new Setting(contentEl)
            .setName('Remember for this session')
            .setDesc('Use this method for all operations until Obsidian is closed')
            .addToggle(toggle => toggle
                .setValue(this.rememberChoice)
                .onChange(value => this.rememberChoice = value));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'age-encrypt-button-container' });
        
        const continueButton = buttonContainer.createEl('button', {
            text: 'Continue',
            cls: 'mod-cta'
        });
        
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });

        continueButton.onclick = () => {
            this.resolve({
                mode: this.selectedMode,
                remember: this.rememberChoice
            });
            this.close();
        };

        cancelButton.onclick = () => {
            this.resolve(null);
            this.close();
        };

        // Add event listener for dropdown changes to update info
        const dropdown = contentEl.querySelector('select');
        if (dropdown) {
            dropdown.addEventListener('change', () => {
                this.updateModeInfo(infoContainer);
            });
        }
    }

    private updateModeInfo(container: HTMLElement): void {
        container.empty();
        
        if (this.selectedMode === 'keyfiles') {
            const infoDiv = container.createDiv({ cls: 'age-encrypt-mode-details' });
            infoDiv.createEl('h4', { text: 'Key Files Mode' });
            infoDiv.createEl('p', { text: 'Uses your configured age key files for encryption/decryption.' });
            infoDiv.createEl('ul').innerHTML = `
                <li>No need to remember passwords</li>
                <li>Requires encrypted key files</li>
            `;
        } else {
            const infoDiv = container.createDiv({ cls: 'age-encrypt-mode-details' });
            infoDiv.createEl('h4', { text: 'Passphrase Mode' });
            infoDiv.createEl('p', { text: 'Uses a password that you provide for encryption/decryption.' });
            infoDiv.createEl('ul').innerHTML = `
                <li>Simple and straightforward</li>
                <li>Only requires remembering a password</li>
                <li>Content can only be decrypted with the exact same password</li>
                <li>Password can be cached for the session</li>
            `;
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}