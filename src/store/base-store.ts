import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';
import { logger } from '../logger.js';
import { latestValidDate } from '../utils.js';

interface Timestamped {
  id: string;
  created: string;
  modified?: string;
}

export abstract class BaseStore<T extends { id: string }> {
  protected itemsById: Map<string, T> = new Map();
  private persistedItemCount: number = 0;

  abstract readonly storageFileName: string;

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
    this.itemsById.set(item.id, item);
    this.onItemAdd(item);
  }

  removeById(id: string): boolean {
    const item = this.itemsById.get(id);
    if (!item) return false;
    this.onItemRemove(item);
    return this.itemsById.delete(id);
  }

  replaceAll(items: T[]): void {
    this.clear();
    for (const item of items) {
      this.add(item);
    }
  }

  getById(id: string): T | undefined {
    return this.itemsById.get(id);
  }

  getAll(): T[] {
    return Array.from(this.itemsById.values());
  }

  clear(): void {
    this.itemsById.clear();
  }

  /**
   * Gets the most recent modification date from all items.
   * Optionally subtracts days for safety margin in incremental sync.
   */
  findLatestTimestamp(lookbackDays = 0): Date | undefined {
    const items = this.getAll() as (T & Timestamped)[];

    let latest: Date | undefined;
    for (const item of items) {
      const date = latestValidDate(item.modified, item.created);
      if (date && (!latest || date.getTime() > latest.getTime())) {
        latest = date;
      }
    }

    if (!latest) return undefined;

    const latestDate = new Date(latest.getTime());
    if (lookbackDays > 0) {
      latestDate.setDate(latestDate.getDate() - lookbackDays);
    }
    return latestDate;
  }

  async saveToDisk(): Promise<void> {
    const data = Array.from(this.itemsById.values());
    const newSize = data.length;
    const added = newSize - this.persistedItemCount;
    logger.info(
      `${this.storageFileName}: ${added} added (${this.persistedItemCount} -> ${newSize})`,
    );
    await writeJsonToFile(data, this.storageFileName);
  }

  async loadFromDisk(): Promise<void> {
    const data = await readJsonFromFile(this.storageFileName);
    if (data && Array.isArray(data)) {
      this.persistedItemCount = data.length;
      this.itemsById = new Map(
        data.map((item: T) => {
          this.onItemLoad(item);
          return [item.id, item];
        }),
      );
    }
  }
}
