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
}

export class EncryptionService {
    private sessionPasswords: Map<string, string> = new Map();
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
    this.keyFileService = new KeyFileService(app);
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

            if (options.remember) {
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

    formatEncryptedBlock(encryptedContent: string, hint?: string): string {
        const block = [
            '```age',
            hint ? `hint: ${hint}` : '',
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
        let contentStartIndex = 0;

        if (lines[0].startsWith('hint: ')) {
            hint = lines[0].substring(6);
            contentStartIndex = 1;
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

        return { content, hint };
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

    // Clear all cached data (passwords and identities)
    clearAllCaches(): void {
        this.sessionPasswords.clear();
        if (this.keyFileService) {
            this.keyFileService.clearCache();
        }
    }

    // Get access to key file service for external use
    getKeyFileService(): KeyFileService | undefined {
        return this.keyFileService;
    }
}
