export interface AgeEncryptSettings {
    defaultHint?: string;
    excludeFrontmatter: boolean;
}

export const DEFAULT_SETTINGS: AgeEncryptSettings = {
    excludeFrontmatter: true
};
