import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import 'dotenv/config'
import fs from "fs";
import path from "path";
import { LogSeq } from "./logseqClient.js";
import winston from "winston";

/* Configure logger with file output */
const logsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'logseq-client.log');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} "${message}"`)
  ),
  transports: [
    new winston.transports.File({ filename: logFile }),
  ]
});

/* Validate API token */
const apiKey = process.env.LOGSEQ_API_TOKEN;
if (!apiKey) {
  throw new Error("LOGSEQ_API_TOKEN environment variable required");
}

/* Initialize LogSeq API client */
const logseqClient = new LogSeq(apiKey);

const server = new McpServer({
  name: "LogSeq-MCP",
  version: "1.0.0"
});

// Create Page Tool
server.tool(
  "create_page",
  {
    title: z.string()
      .min(1, "Title cannot be empty")
      .max(1000, "Title is too long"),
    content: z.string()
      .min(1, "Content cannot be empty")
      .max(1000000, "Content is too long") // 1MB limit
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
      /* Return structured error response */
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Failed to create page: ${error.message}`
        }]
      };
    }
  }
);

/* List Pages Tool */
server.tool(
  "list_pages",
  {
    include_journals: z.boolean()
      .optional()
      .default(false)
      .describe("Whether to include journal/daily notes in the list")
  },
  async ({ include_journals }) => {
    logger.info("Listing pages");

    try {
      const result = await logseqClient.listPages();
      logger.debug(`Raw API response: ${JSON.stringify(result)}`);

      /* Format pages for display */
      const pagesInfo = [];
      let totalPages = 0;
      let journalPages = 0;

      if (!Array.isArray(result)) {
        throw new Error("Invalid response from LogSeq API: Expected an array of pages");
      }

      for (const page of result) {
        /* Validate page object */
        if (!page || typeof page !== 'object') {
          logger.error(`Invalid page object in response: ${JSON.stringify(page)}`);
          continue;
        }

        /* Skip if it's a journal page and we don't want to include those */
        const isJournal = page['journal?'] || false;
        if (isJournal && !include_journals) {
          journalPages++;
          continue;
        }

        /* Get page information with validation */
        const name = page.originalName || page.name || '<unknown>';
        const tags = Array.isArray(page.tags) ? page.tags : [];
        const properties = page.properties && typeof page.properties === 'object' ? page.properties : {};

        /* Build page info string with proper indentation */
        const infoParts = [`- ${name}`];

        if (isJournal) {
          infoParts.push("📅"); /* Add calendar emoji for journal pages */
        }

        if (tags.length > 0) {
          infoParts.push(`🏷️ ${tags.join(', ')}`); /* Add tag emoji */
        }

        if (Object.keys(properties).length > 0) {
          const props = Object.entries(properties)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          infoParts.push(`📝 ${props}`); /* Add properties with note emoji */
        }

        pagesInfo.push(infoParts.join(" "));
        totalPages++;
      }

      /* Sort alphabetically by page name */
      pagesInfo.sort();

      /* Build response with summary statistics */
      const summary = [
        "LogSeq Pages:",
        "", /* Empty line for better readability */
        ...pagesInfo,
        "", /* Empty line before summary */
        `📊 Statistics:`,
        `- Total pages shown: ${totalPages}`,
        include_journals ?
          `- Journal pages: ${journalPages}` :
          `- Journal pages: ${journalPages} (hidden)`,
      ];

      logger.info(`Found ${totalPages} pages${include_journals ? '' : ' (excluding journals)'}`);

      return {
        content: [{
          type: "text",
          text: summary.join("\n")
        }]
      };
    } catch (error) {
      logger.error(`Failed to list pages: ${error.message}`);
      /* Return structured error response */
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Failed to list pages: ${error.message}`
        }]
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);