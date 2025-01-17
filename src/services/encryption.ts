export interface EncryptionOptions {
    password: string;
    hint?: string;
}

export class EncryptionService {
    async encrypt(content: string, options: EncryptionOptions): Promise<string> {
        // TODO: Implement age encryption
        throw new Error('Not implemented');
    }

    async decrypt(encryptedContent: string, password: string): Promise<string> {
        // TODO: Implement age decryption
        throw new Error('Not implemented');
    }

    formatEncryptedBlock(encryptedContent: string, hint?: string): string {
        return [
            '```age',
            hint ? `hint: ${hint}` : '',
            encryptedContent,
            '```'
        ].filter(line => line).join('\n');
    }

    parseEncryptedBlock(block: string): { content: string; hint?: string } {
        // TODO: Implement parsing of encrypted blocks
        throw new Error('Not implemented');
    }
} 