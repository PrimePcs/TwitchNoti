import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { lastNotifiedStreamIds: {} };
  }

  async load() {
    try {
      const data = JSON.parse(await readFile(this.filePath, "utf8"));
      if (data?.lastNotifiedStreamIds && typeof data.lastNotifiedStreamIds === "object") {
        this.state = { lastNotifiedStreamIds: data.lastNotifiedStreamIds };
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return this.state;
  }

  hasNotified(login, streamId) {
    return this.state.lastNotifiedStreamIds[login] === streamId;
  }

  async markNotified(login, streamId) {
    this.state.lastNotifiedStreamIds[login] = streamId;
    await mkdir(path.dirname(this.filePath), { recursive: true });

    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}
