# Age Encrypt NG

Fork and rewrite of [obsidian-age-encrypt](https://github.com/mr-1311/obsidian-age-encrypt) by Metin Ur. Provides advanced [age encryption](https://github.com/FiloSottile/age) for Obsidian notes with key file support and enhanced workflows.

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
