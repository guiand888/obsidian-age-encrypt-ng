import { Encrypter, Decrypter, generateIdentity, identityToRecipient } from "age-encryption";
import { KeyFileInfo } from '../settings';
import { App } from 'obsidian';

export interface DecryptedIdentity {
    keyFilePath: string;
    identity: string;
    recipient: string;
    decryptedAt: number; // Timestamp for session management
}

export class KeyFileService {
    private app: App;
    private decryptedIdentities: Map<string, DecryptedIdentity> = new Map();
    
    constructor(app: App) {
        this.app = app;
    }

    /**
     * Expand shell paths like ~ and environment variables
     */
    private expandPath(path: string): string {
        // Handle ~ expansion
        if (path.startsWith('~/')) {
            const homeDir = require('os').homedir();
            return path.replace('~/', `${homeDir}/`);
        } else if (path === '~') {
            return require('os').homedir();
        }
        
        // Handle environment variables like $HOME
        if (path.includes('$')) {
            return path.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
                return process.env[varName] || match;
            });
        }
        
        return path;
    }

    /**
     * Check if a file path is external to the vault
     */
    private isExternalPath(filePath: string): boolean {
        const expandedPath = this.expandPath(filePath);
        return expandedPath.startsWith('/') || expandedPath.startsWith('~') || expandedPath.includes('$');
    }

    /**
     * Read a key file from disk
     */
    async readKeyFile(filePath: string): Promise<Uint8Array> {
        try {
            const expandedPath = this.expandPath(filePath);
            
            // For external files (outside vault), use Node.js fs
            if (this.isExternalPath(filePath) || expandedPath.startsWith('/')) {
                const fs = require('fs').promises;
                try {
                    await fs.access(expandedPath);
                    const buffer = await fs.readFile(expandedPath);
                    return new Uint8Array(buffer);
                } catch (error) {
                    throw new Error(`External key file not found or not accessible: ${expandedPath}`);
                }
            }

            // For vault-relative files, use Obsidian vault adapter
            let vaultPath = filePath;
            if (!filePath.startsWith('/')) {
                const basePath = (this.app.vault.adapter as any).basePath || '';
                vaultPath = basePath ? `${basePath}/${filePath}` : filePath;
            }

            if (this.app.vault.adapter.exists) {
                const exists = await this.app.vault.adapter.exists(filePath);
                if (!exists) {
                    throw new Error(`Vault key file not found: ${filePath}`);
                }
            }

            const arrayBuffer = await this.app.vault.adapter.readBinary(filePath);
            return new Uint8Array(arrayBuffer);
        } catch (error) {
            throw new Error(`Failed to read key file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Decrypt a key file and extract identities
     */
    async decryptKeyFile(filePath: string, passphrase: string): Promise<string[]> {
        try {
            const encryptedContent = await this.readKeyFile(filePath);
            
            const decrypter = new Decrypter();
            decrypter.addPassphrase(passphrase);
            
            const decryptedContent = await decrypter.decrypt(encryptedContent, "text");
            
            // Parse the decrypted content to extract identities
            const identities = this.parseIdentitiesFromText(decryptedContent);
            
            // Cache the decrypted identities
            for (const identity of identities) {
                const recipient = await identityToRecipient(identity);
                this.decryptedIdentities.set(filePath, {
                    keyFilePath: filePath,
                    identity: identity,
                    recipient: recipient,
                    decryptedAt: Date.now()
                });
            }
            
            return identities;
        } catch (error) {
            throw new Error(`Failed to decrypt key file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Parse identity strings from decrypted key file content
     */
    private parseIdentitiesFromText(content: string): string[] {
        const identities: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and comments
            if (trimmed === '' || trimmed.startsWith('#')) {
                continue;
            }
            // Look for age secret keys
            if (trimmed.startsWith('AGE-SECRET-KEY-1')) {
                identities.push(trimmed);
            }
        }
        
        if (identities.length === 0) {
            throw new Error('No valid identities found in key file');
        }
        
        return identities;
    }

    /**
     * Validate a key file and extract recipient info
     */
    async validateKeyFile(filePath: string, passphrase?: string): Promise<KeyFileInfo> {
        try {
            const expandedPath = this.expandPath(filePath);
            
            // Check if file exists (external or vault)
            let fileExists = false;
            if (this.isExternalPath(filePath) || expandedPath.startsWith('/')) {
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
                return {
                    path: filePath,
                    isValid: false,
                    error: `File not found: ${expandedPath}`
                };
            }

            // If no passphrase provided, we can't validate the content
            if (!passphrase) {
                return {
                    path: filePath,
                    isValid: false,
                    error: 'Passphrase required for validation'
                };
            }

            // Try to decrypt and extract identities
            const identities = await this.decryptKeyFile(filePath, passphrase);
            const recipients: string[] = [];
            
            for (const identity of identities) {
                const recipient = await identityToRecipient(identity);
                recipients.push(recipient);
            }

            return {
                path: filePath,
                isValid: true,
                publicKey: recipients[0] // Return first recipient for display
            };
        } catch (error) {
            return {
                path: filePath,
                isValid: false,
                error: error.message
            };
        }
    }

    /**
     * Get cached decrypted identities for a key file
     */
    getCachedIdentity(filePath: string): DecryptedIdentity | undefined {
        return this.decryptedIdentities.get(filePath);
    }

    /**
     * Get all cached identities
     */
    getAllCachedIdentities(): DecryptedIdentity[] {
        return Array.from(this.decryptedIdentities.values());
    }

    /**
     * Clear cached identities (called on plugin unload)
     */
    clearCache(): void {
        this.decryptedIdentities.clear();
    }

    /**
     * Clear expired cached identities (optional session timeout)
     */
    clearExpiredCache(maxAgeMs: number = 24 * 60 * 60 * 1000): void { // Default 24 hours
        const now = Date.now();
        for (const [filePath, identity] of this.decryptedIdentities.entries()) {
            if (now - identity.decryptedAt > maxAgeMs) {
                this.decryptedIdentities.delete(filePath);
            }
        }
    }

    /**
     * Generate a new identity and save it to a key file
     * (Helper function for testing/setup)
     */
    async generateAndSaveKeyFile(filePath: string, passphrase: string): Promise<string> {
        try {
            const identity = await generateIdentity();
            const recipient = await identityToRecipient(identity);
            
            // Create the key file content
            const keyContent = `# Created: ${new Date().toISOString()}\n# Public key: ${recipient}\n${identity}\n`;
            
            // Encrypt the key file content
            const encrypter = new Encrypter();
            encrypter.setPassphrase(passphrase);
            const encryptedContent = await encrypter.encrypt(keyContent);
            
            // Save to file
            await this.app.vault.adapter.writeBinary(filePath, encryptedContent);
            
            return recipient;
        } catch (error) {
            throw new Error(`Failed to generate key file ${filePath}: ${error.message}`);
        }
    }
}