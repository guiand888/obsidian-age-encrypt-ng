import { Encrypter, Decrypter } from "age-encryption";

export interface EncryptionOptions {
    password: string;
    hint?: string;
    remember?: boolean;
}

export interface EncryptedBlock {
    content: string;
    hint?: string;
}

export class EncryptionService {
    private sessionPasswords: Map<string, string> = new Map();

    private arrayBufferToBase64(buffer: Uint8Array): string {
        const binary = String.fromCharCode(...buffer);
        return btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async encrypt(content: string, options: EncryptionOptions): Promise<string> {
        console.log('Starting encryption...');
        console.log('Content to encrypt:', content);
        try {
            const encrypter = new Encrypter();
            encrypter.setPassphrase(options.password);
            console.log('Encrypting content...');
            const encryptedArray = await encrypter.encrypt(content);
            const encryptedBase64 = this.arrayBufferToBase64(encryptedArray);
            console.log('Content encrypted successfully');
            console.log('Encrypted content (base64):', encryptedBase64);
            
            if (options.remember) {
                this.sessionPasswords.set(encryptedBase64, options.password);
                console.log('Password stored in session');
            }
            return encryptedBase64;
        } catch (error: unknown) {
            console.error('Encryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to encrypt content');
        }
    }

    async decrypt(encryptedContent: string, password: string): Promise<string> {
        console.log('Starting decryption...');
        console.log('Content to decrypt (base64):', encryptedContent);
        try {
            const decrypter = new Decrypter();
            decrypter.addPassphrase(password);
            const encryptedArray = this.base64ToArrayBuffer(encryptedContent);
            console.log('Decrypting content...');
            const result = await decrypter.decrypt(encryptedArray, "text");
            console.log('Content decrypted successfully');
            console.log('Decrypted content:', result);
            return result;
        } catch (error: unknown) {
            console.error('Decryption failed:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to decrypt content');
        }
    }

    formatEncryptedBlock(encryptedContent: string, hint?: string): string {
        console.log('Formatting block with content:', encryptedContent); // Debug log
        
        const block = [
            '```age',
            hint ? `hint: ${hint}` : '',
            encryptedContent,
            '```'
        ]
            .filter(line => line)
            .join('\n');
        
        console.log('Formatted block:', block); // Debug log
        return block;
    }

    parseEncryptedBlock(block: string): EncryptedBlock {
        console.log('Parsing block:', block); // Debug log
        
        // Split by lines and remove empty lines and the age code block markers
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('```'));
        
        console.log('Filtered lines:', lines); // Debug log

        if (lines.length === 0) {
            throw new Error('Invalid encrypted block format: empty content');
        }

        let hint: string | undefined;
        let contentStartIndex = 0;

        if (lines[0].startsWith('hint: ')) {
            hint = lines[0].substring(6);
            contentStartIndex = 1;
        }

        // Join all remaining lines as the content
        const content = lines.slice(contentStartIndex).join('\n');
        
        console.log('Parsed result:', { content, hint }); // Debug log
        
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
} 