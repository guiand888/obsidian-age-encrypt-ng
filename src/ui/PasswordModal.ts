import { Modal, App, Setting } from 'obsidian';

export interface PasswordPromptResult {
    password: string;
    hint?: string;
    remember?: boolean;
}

export class PasswordModal extends Modal {
    private password: string = '';
    private hint: string = '';
    private remember: boolean = false;
    private isEncrypting: boolean;
    private resolve: (value: PasswordPromptResult | null) => void;

    constructor(
        app: App,
        isEncrypting: boolean = false,
        existingHint?: string
    ) {
        super(app);
        this.isEncrypting = isEncrypting;
    }

    async openAndGetPassword(): Promise<PasswordPromptResult | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.isEncrypting ? 'Encrypt Content' : 'Decrypt Content' });

        new Setting(contentEl)
            .setName('Password')
            .setDesc('Enter your password')
            .addText(text => text
                .setPlaceholder('Enter password')
                .setValue(this.password)
                .onChange(value => this.password = value)
                .inputEl.type = 'password'
            );

        if (this.isEncrypting) {
            new Setting(contentEl)
                .setName('Hint (optional)')
                .setDesc('Add a hint to help remember the password')
                .addText(text => text
                    .setPlaceholder('Enter hint')
                    .setValue(this.hint)
                    .onChange(value => this.hint = value)
                );
        }

        new Setting(contentEl)
            .setName('Remember for this session')
            .setDesc('Keep password in memory until Obsidian is closed')
            .addToggle(toggle => toggle
                .setValue(this.remember)
                .onChange(value => this.remember = value)
            );

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(this.isEncrypting ? 'Encrypt' : 'Decrypt')
                .setCta()
                .onClick(() => {
                    if (!this.password) {
                        // Show error
                        return;
                    }
                    this.resolve({
                        password: this.password,
                        hint: this.hint || undefined,
                        remember: this.remember
                    });
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.resolve(null);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 