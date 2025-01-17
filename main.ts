import { 
	Plugin, 
	MarkdownView,
	TFile,
	Notice,
	Editor
} from 'obsidian';

export default class AgeEncryptPlugin extends Plugin {
	async onload() {
		console.log('Loading Age Encrypt plugin');

		// Register the encryption service
		// TODO: Implement encryption service

		// Register the markdown processor for encrypted blocks
		this.registerMarkdownCodeBlockProcessor('age', async (source, el, ctx) => {
			// TODO: Implement encrypted block rendering
		});

		// Add command to encrypt selection
		this.addCommand({
			id: 'encrypt-selection',
			name: 'Encrypt Selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				// TODO: Implement selection encryption
			}
		});

		// Add command to encrypt entire file
		this.addCommand({
			id: 'encrypt-file',
			name: 'Encrypt File',
			callback: async () => {
				// TODO: Implement file encryption
			}
		});
	}

	onunload() {
		console.log('Unloading Age Encrypt plugin');
	}
}
