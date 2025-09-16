# Age Encrypt NG

Fork and rewrite of [obsidian-age-encrypt](https://github.com/mr-1311/obsidian-age-encrypt) by Metin Ur. 🙏🏻  

Provides advanced [age encryption](https://github.com/FiloSottile/age) for Obsidian notes with key file support and enhanced workflows.

## New Features
- Age key file encryption (.age identity files)
- Dual encryption modes: passphrase and key files
- Session management for passwords and identities
- Encryption method metadata in blocks
- Enhanced UI with specialized modals
- Intelligent decryption with method detection
- Mixed mode operation (choose per-encryption)
- Command palette expansion with explicit modes
- Remember toggles for session persistence
- External key file support with path expansion
- Comprehensive settings interface
- Improved error handling and validation

> [!CAUTION]
> **This plugin comes with NO WARRANTY and NO RESPONSIBILITY for any data loss or security breaches, use at your own risk**

## User Guide

### Encryption Methods

**Passphrase Encryption**: Standard symmetric encryption with a password you provide.

**Key File Encryption**: Uses `.age` identity files (which must be encrypted with a passphrase). More secure for shared access scenarios.

### Basic Usage

1. **Encrypt content**: Select text or use command palette
   - `Encrypt Selection` - encrypts selected text (auto mode)
   - `Encrypt File` - encrypts entire file, excludes frontmatter by default (auto mode)
   - Use explicit mode commands for specific encryption type

**Auto Mode**: Uses your configured default encryption method from settings. If set to "mixed" mode, prompts you to choose. Honors remembered session preferences.

2. **Decrypt content**: Click encrypted blocks or use command palette
   - Plugin detects encryption method automatically when possible
   - Shows encryption method and key ID in decrypted view

### Session Management

**Remember Passphrases**: Global setting controls default behavior for remember toggles.

- **Note passphrases**: Remembered per-note, applies only to that specific encrypted block
- **Key file passphrases**: Unlocks the identity, applies to all content encrypted with that key file

**Clear Credentials**: Use `Clear all remembered passphrases and key files` from command palette.

### Backward Compatibility

This plugin is backward compatible with v1.2.0 of the upstream obsidian-age-encrypt. Notes encrypted with the upstream plugin lack encryption metadata, so you'll need to manually select "Passphrase" during decryption (the UI shows "Method Unknown - likely Passphrase" as a hint).

### Settings

- **Encryption Mode**: Choose default behavior (passphrase, key files, or mixed)
- **Key Files**: Configure paths to `.age` identity files
- **Remember by Default**: Control default state of remember toggles
- **Exclude Frontmatter**: When encrypting files, preserve YAML frontmatter

<!--
Original README content commented out for later rewrite:

![](./docs/showcase.gif)

## Features
- Encrypt whole file or selected text using age encryption
- View and edit decrypted content in memory without writing to disk
- Compatible with age CLI tool for external decryption
- Hints can be added to encrypted content

## Usage
Call `Encrypt Selection` command to encrypt selected text or `Encrypt File` to encrypt the entire file from the command palette.

## Security Notes
- Decrypted content is only held in memory
- No automatic writing of decrypted content to disk
- Makes symmetric encryption with a given passphrase, if you lose your passphrase, you lose your data FOREVER
- Based on your vault sync method, your secrets may get synced before you can decrypt them
- Regular backups of your notes are recommended

## Manual Decryption
Encrypted content is stored in code blocks with language set to `age`. For example:
```age
-----BEGIN AGE ENCRYPTED FILE-----
YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IHNjcnlwdCBrUWE0cmIxOFA3NUNXK3d1
V25pT1Z3IDE4ClBaMFY5NWc3bjZIMUxSNHRYSm9FUHMxamdsWjJ3UlhPZjM0R1pm
WFEzOEkKLS0tIHkwaFZNbmQybndaa2dxMkpxdUpOR01uZUQwK21oaSszai9hWnB3
ejJHaW8KxIr7k/vxvgqX0Dqun83t1yyupFW4JOYLzS9uwRSo5OxhCqf88SvxXbs=
-----END AGE ENCRYPTED FILE-----
```
You can always save this to a file and decrypt your content using the age CLI tool:
```bash
# Install age CLI tool first
age -d secret.age
```


## License
MIT License
-->
