import { readJsonFromFile, writeJsonToFile } from '../file-utils';

export abstract class BaseStore<T extends { id: string }> {
  protected itemStore: Map<string, T> = new Map();
  private initialLoadSize: number = 0;

  abstract getFileName(): string;

  protected async onItemLoad(_: T): Promise<void> {
    // No action by default
  }

  protected async onItemAdd(_: T): Promise<void> {
    // No action by default
  }

  add(item: T) {
    this.itemStore.set(item.id, item);
    this.onItemAdd(item);
  }

  getById(id: string): T | undefined {
    return this.itemStore.get(id);
  }

  getAllItems(): T[] {
    return Array.from(this.itemStore.values());
  }

  clearAllItems() {
    this.itemStore.clear();
  }

  async persistItemsToFile(): Promise<void> {
    const data: Array<T> = Array.from(this.itemStore.values());
    const newSize = data.length;
    const added = newSize - this.initialLoadSize;
    console.log(
      `${added} added to ${this.getFileName()}  \t Initial size:${this.initialLoadSize} \t New size: ${newSize}`,
    );
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
