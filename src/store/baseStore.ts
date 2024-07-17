import { readJsonFromFile, writeJsonToFile } from '../fileUtils';

export abstract class BaseStore<T> {
  protected items: Map<string, T> = new Map();

  abstract getFileName(): string;

  add(item: T & { id: string }) {
    this.items.set(item.id, item);
  }

  getById(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  clear() {
    this.items.clear();
  }

  async saveToDisk(): Promise<void> {
    const data = Array.from(this.items.entries());
    await writeJsonToFile(data, this.getFileName());
  }

  async loadFromDisk(): Promise<void> {
    const data = await readJsonFromFile(this.getFileName());
    if (data) {
      this.items = new Map(data);
    }
  }
}
