import { Encrypter, Decrypter, identityToRecipient } from "age-encryption";
import { KeyFileService, DecryptedIdentity } from './keyFileService';
import { EncryptionOptions } from '../settings';
import { App } from 'obsidian';

// Legacy options interface for backward compatibility
export interface LegacyEncryptionOptions {
    password: string;
    hint?: string;
    remember?: boolean;
}

// Enhanced options that support both modes
export interface EnhancedEncryptionOptions extends EncryptionOptions {
    // Inherited from settings: password?, hint?, remember?, useKeyFiles?
    keyFilePaths?: string[];    // Override key files for this operation
    recipients?: string[];      // Override recipients for this operation
}

export interface EncryptedBlock {
    content: string;
    hint?: string;
    method?: string;  // 'passphrase' or 'keyfiles:filename1,filename2' etc.
}

export class EncryptionService {
    private sessionPasswords: Map<string, string> = new Map();
    private sessionEncryptionMode?: 'keyfiles' | 'passphrase' = undefined; // Session override
    private keyFileService?: KeyFileService;

    private arrayBufferToBase64(buffer: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...buffer));
        // Remove any trailing newlines after line wrapping
        return base64.replace(/(.{64})/g, '$1\n').trim();
    }

    private base64ToArrayBuffer(base64: string): Uint8Array {
        const cleanBase64 = base64.replace(/\n/g, '');
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

// Initialize with Obsidian App when available
init(app: App): void {
    try {
        console.log('EncryptionService: Initializing with app instance');
        this.keyFileService = new KeyFileService(app);
        console.log('EncryptionService: KeyFileService initialized successfully');
    } catch (error) {
        console.error('EncryptionService: Failed to initialize KeyFileService:', error);
        throw error;
    }
}

async encrypt(content: string, options: LegacyEncryptionOptions | EnhancedEncryptionOptions): Promise<string> {
        try {
            const encrypter = new Encrypter();

            // Determine encryption mode
            const enhanced = options as EnhancedEncryptionOptions;
            const useKeyFiles = enhanced.useKeyFiles || false;
            const hasRecipients = Array.isArray(enhanced.recipients) && enhanced.recipients.length > 0;

            if (useKeyFiles || hasRecipients) {
                // Add recipients from provided list
                if (hasRecipients) {
                    for (const r of enhanced.recipients!) {
                        encrypter.addRecipient(r);
                    }
                }
                // If we have key files cached identities, add their recipients too
                if (this.keyFileService && enhanced.keyFilePaths && enhanced.keyFilePaths.length > 0) {
                    for (const keyPath of enhanced.keyFilePaths) {
                        const cached = this.keyFileService.getCachedIdentity(keyPath);
                        if (cached?.recipient) {
                            encrypter.addRecipient(cached.recipient);
                        }
                    }
                }
            } else {
                // Default to passphrase mode (legacy behavior)
                encrypter.setPassphrase((options as LegacyEncryptionOptions).password);
            }

            const encryptedArray = await encrypter.encrypt(content);
            const encryptedBase64 = this.arrayBufferToBase64(encryptedArray);

            if (options.remember && options.password) {
                this.sessionPasswords.set(encryptedBase64, options.password);
            }
            return encryptedBase64;
        } catch (error: unknown) {
            console.error('Encryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to encrypt content');
        }
    }

    // Legacy decrypt method for backward compatibility
    async decrypt(encryptedContent: string, password: string): Promise<string> {
        return this.decryptWithOptions(encryptedContent, { password });
    }

    // Enhanced decrypt method that supports multiple decryption methods
    async decryptWithOptions(encryptedContent: string, options: {
        password?: string;
        keyFilePaths?: string[];
        identities?: string[];
    }): Promise<string> {
        try {
            const decrypter = new Decrypter();
            let hasDecryptionMethod = false;

            // Try cached identities first (fastest)
            if (this.keyFileService && options.keyFilePaths) {
                for (const keyPath of options.keyFilePaths) {
                    const cached = this.keyFileService.getCachedIdentity(keyPath);
                    if (cached?.identity) {
                        decrypter.addIdentity(cached.identity);
                        hasDecryptionMethod = true;
                    }
                }
            }

            // Add provided identities
            if (options.identities) {
                for (const identity of options.identities) {
                    decrypter.addIdentity(identity);
                    hasDecryptionMethod = true;
                }
            }

            // Add passphrase as fallback
            if (options.password) {
                decrypter.addPassphrase(options.password);
                hasDecryptionMethod = true;
            }

            if (!hasDecryptionMethod) {
                throw new Error('No decryption method provided (password, identities, or cached key files)');
            }

            const encryptedArray = this.base64ToArrayBuffer(encryptedContent);
            const result = await decrypter.decrypt(encryptedArray, "text");
            return result;
        } catch (error: unknown) {
            console.error('Decryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to decrypt content');
        }
    }

    formatEncryptedBlock(encryptedContent: string, hint?: string, method?: string): string {
        const block = [
            '```age',
            hint ? `hint: ${hint}` : '',
            method ? `method: ${method}` : '',
            '-----BEGIN AGE ENCRYPTED FILE-----',
            encryptedContent,
            '-----END AGE ENCRYPTED FILE-----',
            '```'
        ]
            .filter(line => line)
            .join('\n');

        return block;
    }

    parseEncryptedBlock(block: string): EncryptedBlock {
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('```'));

        if (lines.length === 0) {
            throw new Error('Invalid encrypted block format: empty content');
        }

        let hint: string | undefined;
        let method: string | undefined;
        let contentStartIndex = 0;

        // Parse metadata lines (hint and method)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('hint: ')) {
                hint = lines[i].substring(6);
                contentStartIndex = Math.max(contentStartIndex, i + 1);
            } else if (lines[i].startsWith('method: ')) {
                method = lines[i].substring(8);
                contentStartIndex = Math.max(contentStartIndex, i + 1);
            } else if (lines[i] === '-----BEGIN AGE ENCRYPTED FILE-----') {
                break;
            }
        }

        const beginIndex = lines.findIndex(line => line === '-----BEGIN AGE ENCRYPTED FILE-----');
        const endIndex = lines.findIndex(line => line === '-----END AGE ENCRYPTED FILE-----');

        if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
            throw new Error('Invalid encrypted block format: missing age markers');
        }

        const content = lines.slice(beginIndex + 1, endIndex).join('\n');

        if (!content) {
            throw new Error('Invalid encrypted block format: no content found');
        }

        return { content, hint, method };
    }

    hasStoredPassword(encryptedContent: string): boolean {
        return this.sessionPasswords.has(encryptedContent);
    }

    getStoredPassword(encryptedContent: string): string | undefined {
        return this.sessionPasswords.get(encryptedContent);
    }

    clearStoredPasswords(): void {
        this.sessionPasswords.clear();
    }

    // Session mode management
    setSessionEncryptionMode(mode: 'keyfiles' | 'passphrase' | undefined): void {
        this.sessionEncryptionMode = mode;
    }

    getSessionEncryptionMode(): 'keyfiles' | 'passphrase' | undefined {
        return this.sessionEncryptionMode;
    }

    // Enhanced encrypt method that handles mode selection
    async encryptWithMode(
        content: string, 
        mode: 'keyfiles' | 'passphrase', 
        options: {
            password?: string;
            hint?: string;
            remember?: boolean;
            keyFilePaths?: string[];
            recipients?: string[];
        }
    ): Promise<string> {
        if (mode === 'keyfiles') {
            return this.encrypt(content, {
                useKeyFiles: true,
                keyFilePaths: options.keyFilePaths,
                recipients: options.recipients,
                hint: options.hint
            });
        } else {
            if (!options.password) {
                throw new Error('Password is required for passphrase mode');
            }
            return this.encrypt(content, {
                password: options.password,
                hint: options.hint,
                remember: options.remember
            });
        }
    }

    // Enhanced decrypt method with intelligent fallback
    async decryptIntelligent(
        encryptedContent: string, 
        availableKeyFiles: string[] = [],
        availableRecipients: string[] = []
    ): Promise<{ decryptedContent: string; method: string }> {
        const errors: string[] = [];

        // Try session password cache first (fastest)
        if (this.hasStoredPassword(encryptedContent)) {
            try {
                const password = this.getStoredPassword(encryptedContent)!;
                const decrypted = await this.decrypt(encryptedContent, password);
                return { decryptedContent: decrypted, method: 'cached_password' };
            } catch (error) {
                errors.push(`Cached password failed: ${error.message}`);
            }
        }

        // Try cached key file identities (second fastest)
        if (this.keyFileService && availableKeyFiles.length > 0) {
            const cachedIdentities: string[] = [];
            const cachedKeyFiles: string[] = [];
            
            for (const keyFile of availableKeyFiles) {
                const cached = this.keyFileService.getCachedIdentity(keyFile);
                if (cached?.identity) {
                    cachedIdentities.push(cached.identity);
                    cachedKeyFiles.push(keyFile);
                }
            }

            if (cachedIdentities.length > 0) {
                try {
                    const decrypted = await this.decryptWithOptions(encryptedContent, {
                        identities: cachedIdentities
                    });
                    return { 
                        decryptedContent: decrypted, 
                        method: `cached_keyfiles(${cachedKeyFiles.length})` 
                    };
                } catch (error) {
                    errors.push(`Cached key files failed: ${error.message}`);
                }
            }
        }

        // If we get here, we need user intervention
        throw new Error(`Automatic decryption failed: ${errors.join('; ')}`);
    }

    // Method to unlock key files for use
    async unlockKeyFiles(keyFiles: string[], passphrases: { [filePath: string]: string }): Promise<string[]> {
        if (!this.keyFileService) {
            throw new Error('Key file service not available');
        }

        const unlockedFiles: string[] = [];
        const errors: string[] = [];

        for (const keyFile of keyFiles) {
            const passphrase = passphrases[keyFile];
            if (!passphrase) {
                errors.push(`No passphrase provided for ${keyFile}`);
                continue;
            }

            try {
                await this.keyFileService.decryptKeyFile(keyFile, passphrase);
                unlockedFiles.push(keyFile);
            } catch (error) {
                errors.push(`Failed to unlock ${keyFile}: ${error.message}`);
            }
        }

        if (errors.length > 0 && unlockedFiles.length === 0) {
            throw new Error(`Failed to unlock any key files: ${errors.join('; ')}`);
        }

        return unlockedFiles;
    }

    // Method to validate configuration for a given mode
    validateModeConfiguration(mode: 'keyfiles' | 'passphrase' | 'mixed', keyFiles: string[], recipients: string[]): {
        valid: boolean;
        error?: string;
        warnings?: string[];
    } {
        const warnings: string[] = [];

        if (mode === 'keyfiles') {
            if (keyFiles.length === 0 && recipients.length === 0) {
                return {
                    valid: false,
                    error: 'Key files mode requires at least one key file or recipient to be configured'
                };
            }

            // Check if key files exist and are cached
            if (this.keyFileService && keyFiles.length > 0) {
                const unlockedCount = keyFiles.filter(kf => 
                    this.keyFileService!.getCachedIdentity(kf)
                ).length;
                
                if (unlockedCount === 0) {
                    warnings.push('No key files are currently unlocked. You will need to enter passphrases.');
                }
            }

            return { valid: true, warnings };
        } else if (mode === 'passphrase') {
            return { valid: true };
        } else { // mixed
            if (keyFiles.length === 0 && recipients.length === 0) {
                warnings.push('No key files or recipients configured. Mixed mode will only offer passphrase option.');
            }
            return { valid: true, warnings };
        }
    }

    // Clear all cached data (passwords and identities)
    clearAllCaches(): void {
        this.sessionPasswords.clear();
        this.sessionEncryptionMode = undefined;
        if (this.keyFileService) {
            this.keyFileService.clearCache();
        }
    }

    // Get access to key file service for external use
    getKeyFileService(): KeyFileService | undefined {
        console.log('getKeyFileService called, keyFileService is:', this.keyFileService ? 'initialized' : 'undefined');
        return this.keyFileService;
    }
}
