import { Modal, App, Setting } from 'obsidian';

export interface PasswordPromptResult {
    password: string;
    hint?: string;
    remember?: boolean;
}

export class PasswordModal extends Modal {
    private password: string = '';
    private confirmPassword: string = '';
    private hint: string = '';
    private remember: boolean = true;
    private isEncrypting: boolean;
    private errorEl: HTMLElement | null = null;
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
        contentEl.createEl('h2', { text: this.isEncrypting ? 'Encrypt content' : 'Decrypt content' });

        const showError = (message: string) => {
            if (this.errorEl) {
                this.errorEl.textContent = message;
            } else {
                this.errorEl = contentEl.createEl('p', {
                    text: message,
                    cls: 'age-encrypt-error'
                });
                this.errorEl.style.color = 'var(--text-error)';
                this.errorEl.style.marginTop = '1em';
            }
        };

        const clearError = () => {
            if (this.errorEl) {
                this.errorEl.remove();
                this.errorEl = null;
            }
        };

        const submitHandler = () => {
            clearError();

            if (!this.password) {
                showError('Password is required');
                return;
            }

            if (this.isEncrypting) {
                if (!this.confirmPassword) {
                    showError('Please confirm your password');
                    return;
                }
                if (this.password !== this.confirmPassword) {
                    showError('Passwords do not match');
                    return;
                }
            }

            this.resolve({
                password: this.password,
                hint: this.hint || undefined,
                remember: this.remember
            });
            this.close();
        };

        new Setting(contentEl)
            .setName('Password')
            .setDesc('Enter your password')
            .addText(text => {
                text
                    .setPlaceholder('Enter password')
                    .setValue(this.password)
                    .onChange(value => this.password = value);
                text.inputEl.type = 'password';
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submitHandler();
                    }
                });
                return text;
            });

        if (this.isEncrypting) {
            new Setting(contentEl)
                .setName('Confirm Password')
                .setDesc('Re-enter your password to confirm')
                .addText(text => {
                    text
                        .setPlaceholder('Confirm password')
                        .setValue(this.confirmPassword)
                        .onChange(value => this.confirmPassword = value);
                    text.inputEl.type = 'password';
                    text.inputEl.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submitHandler();
                        }
                    });
                    return text;
                });

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
                .onClick(() => submitHandler()))
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
