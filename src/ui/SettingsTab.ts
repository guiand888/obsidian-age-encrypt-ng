import { App, PluginSettingTab, Setting, Notice, TextComponent } from 'obsidian';
import AgeEncryptPlugin from '../../main';
import { KeyFileInfo } from '../settings';

export class AgeEncryptSettingTab extends PluginSettingTab {
    plugin: AgeEncryptPlugin;

    constructor(app: App, plugin: AgeEncryptPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Age Encrypt Settings' });

        // Encryption Mode Section
        containerEl.createEl('h3', { text: 'Encryption Mode' });
        
        new Setting(containerEl)
            .setName('Default encryption mode')
            .setDesc('Choose how encryption operations should work by default')
            .addDropdown(dropdown => dropdown
                .addOption('passphrase', 'Passphrase only')
                .addOption('keyfiles', 'Key files only')
                .addOption('mixed', 'Mixed mode (ask each time)')
                .setValue(this.plugin.settings.encryptionMode)
                .onChange(async (value: 'passphrase' | 'keyfiles' | 'mixed') => {
                    this.plugin.settings.encryptionMode = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide relevant sections
                }));

        // Key Files Section (show if keyfiles or mixed mode)
        if (this.plugin.settings.encryptionMode === 'keyfiles' || this.plugin.settings.encryptionMode === 'mixed') {
            this.displayKeyFileSettings(containerEl);
        }

        // Recipients Section (show if keyfiles or mixed mode)
        if (this.plugin.settings.encryptionMode === 'keyfiles' || this.plugin.settings.encryptionMode === 'mixed') {
            this.displayRecipientSettings(containerEl);
        }

        // General Settings Section
        containerEl.createEl('h3', { text: 'General Settings' });
        
        new Setting(containerEl)
            .setName('Exclude frontmatter from encryption')
            .setDesc('If enabled, the YAML frontmatter will not be encrypted when using the "Encrypt file" command.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeFrontmatter)
                .onChange(async (value) => {
                    this.plugin.settings.excludeFrontmatter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default hint')
            .setDesc('Default hint text to use for new encryptions (can be overridden per operation)')
            .addText(text => text
                .setPlaceholder('Enter default hint')
                .setValue(this.plugin.settings.defaultHint || '')
                .onChange(async (value) => {
                    this.plugin.settings.defaultHint = value || undefined;
                    await this.plugin.saveSettings();
                }));
    }

    private displayKeyFileSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Key Files' });
        
        containerEl.createEl('p', { 
            text: 'Encrypted key files containing age identities. These files should be encrypted with passphrases.',
            cls: 'setting-item-description'
        });

        // Add new key file
        let currentPathInput: TextComponent;
        new Setting(containerEl)
            .setName('Add key file')
            .setDesc('Path to an encrypted key file (.age extension recommended)')
            .addText(text => {
                currentPathInput = text
                    .setPlaceholder('~/path/to/keyfile.age or /absolute/path/keyfile.age')
                    .onChange(() => {});
                return currentPathInput;
            })
            .addButton(btn => btn
                .setButtonText('Add')
                .setCta()
                .onClick(async () => {
                    const rawPath = currentPathInput.getValue().trim();
                    console.log('Adding key file - Raw path:', rawPath);
                    
                    if (!rawPath) {
                        new Notice('Please enter a key file path');
                        return;
                    }
                    
                    // Expand path (handle ~ and environment variables)
                    const expandedPath = this.expandPath(rawPath);
                    console.log('Expanded path:', expandedPath);
                    
                    if (this.plugin.settings.keyFiles.includes(expandedPath)) {
                        new Notice('Key file already exists in the list');
                        return;
                    }

                    this.plugin.settings.keyFiles.push(expandedPath);
                    await this.plugin.saveSettings();
                    currentPathInput.setValue('');
                    this.display();
                    
                    new Notice(`Added key file: ${expandedPath}`);
                }));

        // List existing key files
        if (this.plugin.settings.keyFiles.length > 0) {
            containerEl.createEl('h4', { text: 'Configured Key Files' });
            
            for (let i = 0; i < this.plugin.settings.keyFiles.length; i++) {
                const keyFile = this.plugin.settings.keyFiles[i];
                const setting = new Setting(containerEl)
                    .setName(keyFile)
                    .setDesc('Encrypted key file path')
                    .addButton(btn => btn
                        .setButtonText('Test')
                        .setTooltip('Test key file access and validation')
                        .onClick(async () => {
                            await this.testKeyFile(keyFile);
                        }))
                    .addButton(btn => btn
                        .setButtonText('Remove')
                        .setWarning()
                        .onClick(async () => {
                            this.plugin.settings.keyFiles.splice(i, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }));
                
                // Show key file status if we can determine it
                const keyFileService = this.plugin.encryptionService.getKeyFileService();
                if (keyFileService) {
                    const cached = keyFileService.getCachedIdentity(keyFile);
                    if (cached) {
                        setting.setDesc(`✓ Unlocked (recipient: ${cached.recipient.substring(0, 20)}...)`);
                    }
                }
            }
        }
    }

    private displayRecipientSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Direct Recipients' });
        
        containerEl.createEl('p', { 
            text: 'Direct age public keys (age1...) for encryption. These can be used alongside or instead of key files.',
            cls: 'setting-item-description'
        });

        // Add new recipient
        new Setting(containerEl)
            .setName('Add recipient')
            .setDesc('Age public key (starts with age1...)')
            .addText(text => {
                let recipientInput: TextComponent;
                recipientInput = text
                    .setPlaceholder('age1abc123...')
                    .onChange(() => {});
                return recipientInput;
            })
            .addButton(btn => btn
                .setButtonText('Add')
                .setCta()
                .onClick(async () => {
                    const recipientInput = containerEl.querySelector('.setting-item:last-of-type input') as HTMLInputElement;
                    const recipient = recipientInput?.value.trim();
                    if (!recipient) {
                        new Notice('Please enter a recipient public key');
                        return;
                    }
                    
                    if (!recipient.startsWith('age1')) {
                        new Notice('Invalid age public key format (must start with age1)');
                        return;
                    }
                    
                    if (this.plugin.settings.recipients.includes(recipient)) {
                        new Notice('Recipient already exists in the list');
                        return;
                    }

                    this.plugin.settings.recipients.push(recipient);
                    await this.plugin.saveSettings();
                    recipientInput.value = '';
                    this.display();
                }));

        // List existing recipients
        if (this.plugin.settings.recipients.length > 0) {
            containerEl.createEl('h4', { text: 'Configured Recipients' });
            
            for (let i = 0; i < this.plugin.settings.recipients.length; i++) {
                const recipient = this.plugin.settings.recipients[i];
                new Setting(containerEl)
                    .setName(`${recipient.substring(0, 20)}...`)
                    .setDesc(`Full key: ${recipient}`)
                    .addButton(btn => btn
                        .setButtonText('Remove')
                        .setWarning()
                        .onClick(async () => {
                            this.plugin.settings.recipients.splice(i, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }));
            }
        }
    }

    // Helper method to expand shell paths like ~ and environment variables
    private expandPath(path: string): string {
        console.log('expandPath - Input:', path);
        
        // Handle ~ expansion
        if (path.startsWith('~/')) {
            const homeDir = require('os').homedir();
            const expanded = path.replace('~/', `${homeDir}/`);
            console.log('expandPath - Tilde expansion:', expanded);
            return expanded;
        } else if (path === '~') {
            const homeDir = require('os').homedir();
            console.log('expandPath - Home dir:', homeDir);
            return homeDir;
        }
        
        // Handle environment variables like $HOME
        if (path.includes('$')) {
            const expanded = path.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
                const value = process.env[varName] || match;
                console.log(`expandPath - Env var ${varName}:`, value);
                return value;
            });
            console.log('expandPath - Env expansion:', expanded);
            return expanded;
        }
        
        console.log('expandPath - No expansion needed:', path);
        return path;
    }

    private async testKeyFile(filePath: string): Promise<void> {
        const keyFileService = this.plugin.encryptionService.getKeyFileService();
        if (!keyFileService) {
            new Notice('Key file service not available');
            return;
        }

        try {
            const expandedPath = this.expandPath(filePath);
            
            // Check if file exists (external or vault)
            let fileExists = false;
            if (expandedPath.startsWith('/') || filePath.startsWith('~') || filePath.includes('$')) {
                // Use Node.js fs for external files
                const fs = require('fs').promises;
                try {
                    await fs.access(expandedPath);
                    fileExists = true;
                } catch {
                    fileExists = false;
                }
            } else {
                // Use vault adapter for vault files
                fileExists = await this.app.vault.adapter.exists(filePath);
            }
            
            if (!fileExists) {
                new Notice(`Key file not found: ${expandedPath}`);
                return;
            }

            // Check if already cached (unlocked)
            const cached = keyFileService.getCachedIdentity(filePath);
            if (cached) {
                new Notice(`✓ Key file is unlocked\nRecipient: ${cached.recipient}`);
                return;
            }

            new Notice(`Key file exists but is locked. Use encryption/decryption commands to unlock it.`);
        } catch (error) {
            new Notice(`Error testing key file: ${error.message}`);
        }
    }
}
