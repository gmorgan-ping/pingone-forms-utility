# p1-forms CLI

A TypeScript CLI tool for exporting and importing PingOne Forms between environments.

## Installation

```bash
npm install
```

## Configuration

Create `environments.json` with your PingOne environments:

```json
[
  {
    "name": "Dev US",
    "envId": "11111111-2222-3333-4444-555555555555",
    "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "clientSecret": "your-secret-here",
    "tld": "com"
  }
]
```

**Region TLD values**: `com` (US), `eu` (Europe), `ca` (Canada), `asia` (Asia Pacific), `com.au` (Australia), `sg` (Singapore)


## Usage

```bash
npm start
```

The CLI will guide you through:

1. **Select operation**: Export or Import
2. **Choose environment**: From your configured environments  
3. **Select forms**: Multi-select with checkboxes
4. **Review summary**: Confirm your selections

### Export

- Downloads forms from PingOne
- Removes metadata fields for portability
- Saves to `./forms/` directory as JSON files

### Import

- Scans `./forms/` directory for JSON files
- Prompts for custom form names
- Uploads to selected PingOne environment

## Options

```bash
npm start -- --verbose    # Enable detailed logging
```
