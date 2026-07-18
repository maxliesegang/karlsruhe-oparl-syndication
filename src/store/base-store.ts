import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';
import { logger } from '../logger.js';

interface Timestamped {
  id: string;
  created: string;
  modified?: string;
}

export abstract class BaseStore<T extends { id: string }> {
  protected itemStore: Map<string, T> = new Map();
  private initialLoadSize: number = 0;

  abstract getFileName(): string;

  protected onItemLoad(_item: T): void {
    // Override in subclass if needed
  }

  protected onItemAdd(_item: T): void {
    // Override in subclass if needed
  }

  protected onItemRemove(_item: T): void {
    // Override in subclass if needed
  }

  add(item: T): void {
    if ((item as T & { deleted?: boolean }).deleted) {
      this.removeById(item.id);
      return;
    }
    this.itemStore.set(item.id, item);
    this.onItemAdd(item);
  }

  removeById(id: string): boolean {
    const item = this.itemStore.get(id);
    if (!item) return false;
    this.onItemRemove(item);
    return this.itemStore.delete(id);
  }

  replaceAll(items: T[]): void {
    this.clearAllItems();
    for (const item of items) {
      this.add(item);
    }
  }

  getById(id: string): T | undefined {
    return this.itemStore.get(id);
  }

  getAllItems(): T[] {
    return Array.from(this.itemStore.values());
  }

  clearAllItems(): void {
    this.itemStore.clear();
  }

  /**
   * Gets the most recent modification date from all items.
   * Optionally subtracts days for safety margin in incremental sync.
   */
  getLastModified(subtractDays = 0): Date | undefined {
    const items = this.getAllItems() as (T & Timestamped)[];
    const allDates = items.map((item) =>
      item.modified ? new Date(item.modified) : new Date(item.created),
    );

    if (!allDates.length) return undefined;

    const latestDate = new Date(Math.max(...allDates.map((date) => date.getTime())));
    if (subtractDays > 0) {
      latestDate.setDate(latestDate.getDate() - subtractDays);
    }
    return latestDate;
  }

  async persistItemsToFile(): Promise<void> {
    const data = Array.from(this.itemStore.values());
    const newSize = data.length;
    const added = newSize - this.initialLoadSize;
    logger.info(`${this.getFileName()}: ${added} added (${this.initialLoadSize} -> ${newSize})`);
    await writeJsonToFile(data, this.getFileName());
  }

  async loadItemsFromFile(): Promise<void> {
    const data = await readJsonFromFile(this.getFileName());
    if (data && Array.isArray(data)) {
      this.initialLoadSize = data.length;
      this.itemStore = new Map(
        data.map((item: T) => {
          this.onItemLoad(item);
          return [item.id, item];
        }),
      );
    }
  }
}
