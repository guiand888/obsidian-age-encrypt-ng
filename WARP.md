# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

An Obsidian plugin providing age-based encryption for notes. The plugin encrypts content in-place using age encryption and stores encrypted blocks in markdown code blocks with the `age` language identifier.

## Architecture

### Core Components
- **`main.ts`**: Main plugin entry point with command registration and markdown processor
- **`src/services/encryption.ts`**: Core encryption/decryption logic using age-encryption library
- **`src/ui/PasswordModal.ts`**: Modal for password input with encryption/decryption modes
- **`src/ui/SettingsTab.ts`**: Plugin settings interface
- **`src/settings.ts`**: Settings type definitions and defaults

### Key Design Patterns
- **In-memory decryption**: Decrypted content never touches disk, only held in memory
- **Session password storage**: Optional password caching per encrypted block during session
- **Markdown code block integration**: Uses `age` language identifier for encrypted content
- **Dual encryption modes**: Selection encryption vs full file encryption with optional frontmatter exclusion

### Data Flow
1. Content → PasswordModal → EncryptionService.encrypt() → formatted code block
2. Code block → MarkdownProcessor → PasswordModal → EncryptionService.decrypt() → editable textarea
3. Edited content → re-encryption or plain text save

## Development Commands

### Build & Development
```bash
# Development mode with watch
npm run dev

# Production build with type checking
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version
```

### Build System
- **esbuild**: Bundler with development watch mode
- **TypeScript**: Type checking (no emit, bundling handled by esbuild)
- **Target**: ES2016 for Obsidian compatibility

### Linting
```bash
# Run ESLint
npx eslint . --ext .ts

# ESLint with auto-fix
npx eslint . --ext .ts --fix
```

## Key Technical Details

### Encryption Format
Encrypted blocks follow this structure:
```markdown
```age
hint: optional hint text
-----BEGIN AGE ENCRYPTED FILE-----
base64-encoded-content-with-line-wrapping
-----END AGE ENCRYPTED FILE-----
```
```

### Session Management
- Passwords stored in `Map<encryptedContent, password>` for session duration
- Cleared on plugin unload
- Optional per-encryption basis

### File Operations
- **Selection encryption**: Replaces selected text with encrypted block
- **File encryption**: Encrypts entire file content (with frontmatter exclusion option)
- **In-place editing**: Decrypted content shown in textarea with save options

### Security Features
- No persistent password storage
- Base64 encoding with 64-character line wrapping
- Age encryption with passphrase-based symmetric encryption
- Memory-only decryption workflow

## Dependencies

### Runtime
- `age-encryption`: Core encryption library
- `obsidian`: Obsidian API

### Development  
- `esbuild`: Fast bundler
- `typescript`: Type checking
- `@typescript-eslint/*`: TypeScript ESLint integration

## Code Style
- 4-space indentation
- Single quotes
- Explicit function return types required
- No unused variables or explicit any types

## Environment & Development Setup

### Distrobox Requirements
- **CRITICAL**: All Node.js, npm, go, and compilation commands must be run inside distrobox container `obsidian-dev-24`
- Never install packages or run build commands directly on the host system
- Use format: `distrobox enter obsidian-dev-24 -- bash -c "command"`
- Example: `distrobox enter obsidian-dev-24 -- bash -c "cd /path && npm run build"`

### Project Paths
- **Plugin Development**: `/home/guillaume/Development/obsidian-age-encrypt`
- **Age Reference Implementation**: `/home/guillaume/Development/age`
- **Obsidian Test Vault**: `/home/guillaume/Obsidian-testing/testing`
- **Plugin Deployment**: `/home/guillaume/Obsidian-testing/testing/.obsidian/plugins/obsidian-age-encrypt/`
- **Age Test Keys**: `/home/guillaume/Development/obsidian-age-encrypt/.age/`

### File Deployment
When updating the plugin, always copy these files to the test vault:
```bash
cp main.js /home/guillaume/Obsidian-testing/testing/.obsidian/plugins/obsidian-age-encrypt/main.js
cp styles.css /home/guillaume/Obsidian-testing/testing/.obsidian/plugins/obsidian-age-encrypt/styles.css
cp manifest.json /home/guillaume/Obsidian-testing/testing/.obsidian/plugins/obsidian-age-encrypt/manifest.json
```

## Development Workflow
- **CRITICAL**: After completing any user-requested task or feature, always create a git commit if working in a git repository
- Commit messages should be descriptive and follow conventional format
- Keep commits focused on single features or fixes
- Always ensure code builds successfully before committing
