import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class FileConfigStore {
  constructor({ directory, defaults = {} }) {
    this.directory = directory;
    this.defaults = { ...defaults };
  }

  get file() {
    return join(this.directory, "config.json");
  }

  ensureDirectory() {
    if (!existsSync(this.directory)) mkdirSync(this.directory, { recursive: true });
  }

  load() {
    this.ensureDirectory();
    if (!existsSync(this.file)) {
      this.save(this.defaults);
      return { ...this.defaults };
    }
    return JSON.parse(readFileSync(this.file, "utf-8"));
  }

  save(config) {
    this.ensureDirectory();
    writeFileSync(this.file, JSON.stringify(config, null, 2));
  }
}
