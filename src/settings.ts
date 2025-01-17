export interface AgeEncryptSettings {
    defaultHint?: string;
    preserveHeadings: boolean;
    encryptTitles: boolean;
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    preserveHeadings: true,
    encryptTitles: false
}; 