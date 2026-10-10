import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class CommunityStateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { tickets: {}, giveaways: {} };
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      this.data = {
        tickets: parsed?.tickets && typeof parsed.tickets === "object" ? parsed.tickets : {},
        giveaways:
          parsed?.giveaways && typeof parsed.giveaways === "object" ? parsed.giveaways : {},
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return this.data;
  }

  async save() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

