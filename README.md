# Logseq MCP Server

## Overview
The `logseq-mcp-server` is a server-side application designed for local use with the Model Context Protocol (MCP) using the `@modelcontextprotocol/sdk`. It communicates via the standard input/output (stdio) MCP transport, providing backend support for Logseq-related operations and leveraging modern JavaScript features with ES modules.

## Features
- Integration with the Model Context Protocol (MCP) via `@modelcontextprotocol/sdk`.
- REST API support using `axios`.
- Environment variable management with `dotenv`.
- Logging capabilities powered by `winston`.

## Project Structure
```
logseq-mcp-server/
├── backup/                # Backup files
├── logs/                  # Log files
│   └── logseq-client.log  # Log file for Logseq client
├── src/                   # Source code
│   ├── logseqClient.js    # Logseq client implementation
│   └── server.js          # Main server file
├── package.json           # Project metadata and dependencies
├── README.md              # Project documentation
```

## Prerequisites
- Node.js (v22 or higher)

## Installation
1. Clone the repository:
   ```zsh
   git clone https://github.com/calvinchan/logseq-mcp-server.git
   ```
2. Navigate to the project directory:
   ```zsh
   cd logseq-mcp-server
   ```
3. Install dependencies:
   ```zsh
   npm install
   ```

## Usage
### Development Mode
To start the server in development mode with live reloading:
```zsh
npm run dev
```

### Environment Variables
Create a `.env` file in the root directory to configure environment variables. Example:
```
LOGSEQ_API_TOKEN=()
```

## Dependencies
- `@modelcontextprotocol/sdk`: MCP integration.
- `axios`: HTTP client for API requests.
- `dotenv`: Environment variable management.
- `winston`: Logging library.

## License
This project is licensed under the ISC License.
