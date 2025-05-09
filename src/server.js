import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Create logs directory if it doesn't exist
const logsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure logger with file output
const logFile = path.join(logsDir, 'logseq-mcp.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const timestamp = () => new Date().toISOString();

const logger = {
  info: (msg) => {
    const logMsg = `[${timestamp()}] INFO: ${msg}`;
    //console.log(`INFO: ${msg}`);
    logStream.write(logMsg + '\n');
  },
  debug: (msg) => {
    const logMsg = `[${timestamp()}] DEBUG: ${msg}`;
    //console.debug(`DEBUG: ${msg}`);
    logStream.write(logMsg + '\n');
  },
  error: (msg) => {
    const logMsg = `[${timestamp()}] ERROR: ${msg}`;
    //console.error(`ERROR: ${msg}`);
    logStream.write(logMsg + '\n');
  }
};

// Validate API token
const apiKey = process.env.LOGSEQ_API_TOKEN;
if (!apiKey) {
  throw new Error("LOGSEQ_API_TOKEN environment variable required");
} else {
  logger.info("Found LOGSEQ_API_TOKEN in environment");
  logger.debug(`API Token starts with: ${apiKey.substring(0, 5)}...`);
}

// LogSeq API client
class LogSeq {
  constructor(apiKey, host = "127.0.0.1", port = 12315) {
    this.apiKey = apiKey;
    this.host = host;
    this.port = port;
    logger.debug(`LogSeq client initialized with host=${host}, port=${port}`);
  }

  getBaseUrl() {
    const url = `http://${this.host}:${this.port}/api`;
    logger.debug(`Base URL: ${url}`);
    return url;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createPage(title, content) {
    const url = this.getBaseUrl();
    logger.info(`Creating page '${title}'`);

    const payload = {
      method: "logseq.Editor.insertBlock",
      args: [
        title,
        content,
        { isPageBlock: true }
      ]
    };
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        url,
        payload,
        { headers: this.getHeaders(), timeout: 6000 }
      );
      logger.debug(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error(`Error creating page: ${error.message}`);
      throw error;
    }
  }

  async listPages() {
    const url = this.getBaseUrl();
    logger.info("Listing all pages");

    const payload = {
      method: "logseq.Editor.getAllPages"
    };
    logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        url,
        payload,
        { headers: this.getHeaders(), timeout: 6000 }
      );
      logger.debug(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error(`Error listing pages: ${error.message}`);
      throw error;
    }
  }
}

const server = new McpServer({
  name: "LogSeq-MCP",
  version: "1.0.0"
});

// Initialize LogSeq API client
const logseqClient = new LogSeq(apiKey);

// Create Page Tool
server.tool(
  "create_page",
  {
    title: z.string().describe("Title of the new page"),
    content: z.string().describe("Content of the new page")
  },
  async ({ title, content }) => {
    logger.info(`Creating page with title: ${title}`);

    try {
      const result = await logseqClient.createPage(title, content);
      logger.info("Successfully created page");
      logger.debug(`API response: ${JSON.stringify(result)}`);

      return {
        content: [{
          type: "text",
          text: `Successfully created page '${title}'`
        }]
      };
    } catch (error) {
      logger.error(`Failed to create page: ${error.message}`);
      throw error;
    }
  }
);

// List Pages Tool
server.tool(
  "list_pages",
  {
    include_journals: z.boolean().optional().default(false).describe("Whether to include journal/daily notes in the list")
  },
  async ({ include_journals }) => {
    logger.info("Listing pages");

    try {
      const result = await logseqClient.listPages();
      logger.debug(`Raw API response: ${JSON.stringify(result)}`);

      // Format pages for display
      const pagesInfo = [];

      for (const page of result) {
        // Skip if it's a journal page and we don't want to include those
        const isJournal = page['journal?'] || false;
        if (isJournal && !include_journals) {
          continue;
        }

        // Get page information
        const name = page.originalName || page.name || '<unknown>';
        const tags = page.tags || [];
        const properties = page.properties || {};

        // Build page info string
        const infoParts = [`- ${name}`];

        if (tags.length > 0) {
          infoParts.push(`(tags: ${tags.join(', ')})`);
        }

        if (Object.keys(properties).length > 0) {
          const props = Object.entries(properties).map(([k, v]) => `${k}: ${v}`);
          infoParts.push(`[${props.join(', ')}]`);
        }

        if (isJournal) {
          infoParts.push("[journal]");
        }

        pagesInfo.push(infoParts.join(" "));
      }

      // Sort alphabetically by page name
      pagesInfo.sort();

      // Build response
      const countMsg = `\nTotal pages: ${pagesInfo.length}`;
      const journalMsg = include_journals ? " (including journal pages)" : " (excluding journal pages)";

      const response = "LogSeq Pages:\n\n" + pagesInfo.join("\n") + countMsg + journalMsg;

      logger.info(`Found ${pagesInfo.length} pages`);

      return {
        content: [{
          type: "text",
          text: response
        }]
      };
    } catch (error) {
      logger.error(`Failed to list pages: ${error.message}`);
      throw error;
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);