import axios from "axios";
import fs from "fs";
import path from "path";
import winston from "winston";

/* Configure logger with file output */
const logsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'logseq-client.log');

export class LogSeq {
  constructor(apiKey, host = "127.0.0.1", port = 12315) {
    const logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} "${message}"`)
      ),
      transports: [
        new winston.transports.File({ filename: logFile }),
        // new winston.transports.Console()
      ]
    });
    this.apiKey = apiKey;
    this.host = host;
    this.port = port;
    this.logger = logger;
    this.logger.debug(`LogSeq client initialized with host=${host}, port=${port}`);
  }

  getBaseUrl() {
    const url = `http://${this.host}:${this.port}/api`;
    this.logger.debug(`Base URL: ${url}`);
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
    this.logger.info(`Creating page '${title}'`);

    const payload = {
      method: "logseq.Editor.insertBlock",
      args: [
        title,
        content,
        { isPageBlock: true }
      ]
    };
    this.logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        url,
        payload,
        { headers: this.getHeaders(), timeout: 6000 }
      );
      this.logger.debug(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating page: ${error.message}`);
      throw error;
    }
  }

  async listPages() {
    const url = this.getBaseUrl();
    this.logger.info("Listing all pages");

    const payload = {
      method: "logseq.Editor.getAllPages"
    };
    this.logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        url,
        payload,
        { headers: this.getHeaders(), timeout: 6000 }
      );
      this.logger.debug(`Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error listing pages: ${error.message}`);
      throw error;
    }
  }
}
