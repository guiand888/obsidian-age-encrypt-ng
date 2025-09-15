// Key file validation result
export interface KeyFileInfo {
    path: string;
    isValid: boolean;
    publicKey?: string;  // Derived recipient if valid
    error?: string;
}

// Encryption options for backward compatibility
export interface EncryptionOptions {
    password?: string;
    hint?: string;
    remember?: boolean;
    // New options for key files
    useKeyFiles?: boolean;
}

export interface AgeEncryptSettings {
    defaultHint?: string;
    excludeFrontmatter: boolean;
    // Key file configuration
    keyFiles: string[];              // Paths to .age encrypted key files
    recipients: string[];            // Direct recipient public keys (age1...)
    // Encryption mode preference
    encryptionMode: 'passphrase' | 'keyfiles' | 'mixed';
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    excludeFrontmatter: true,
    keyFiles: [],
    recipients: [],
    encryptionMode: 'passphrase'  // Default to current behavior
};
