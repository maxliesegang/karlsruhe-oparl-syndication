import { BaseStore } from './base-store';
import { Paper } from '../types';
import { store } from './index';
import { FileContentType } from '../types/file-content-type';

class PaperStore extends BaseStore<Paper> {
  private consultationPapers: Map<string, string> = new Map();
  private paperConsultations: Map<string, Set<string>> = new Map();
  private filePapers: Map<string, Set<string>> = new Map();
  private paperFiles: Map<string, Set<string>> = new Map();
  private updatedPaperIds: Set<string> = new Set();

  getFileName(): string {
    return 'papers.json';
  }

  getLastModifiedWithSafetyMargin(): Date | undefined {
    return this.getLastModified(1); // Subtract 1 day for safety
  }

  getPaperByConsultationId(consultationId: string): Paper | undefined {
    const paperId = this.consultationPapers.get(consultationId);
    return paperId ? this.getById(paperId) : undefined;
  }

  consumeUpdatedPaperIds(): string[] {
    const ids = Array.from(this.updatedPaperIds);
    this.updatedPaperIds.clear();
    return ids;
  }

  getPaperIdsByFileIds(fileIds: Iterable<string>): string[] {
    const paperIds = new Set<string>();
    for (const fileId of fileIds) {
      const mappedPaperIds = this.filePapers.get(fileId);
      if (!mappedPaperIds) continue;
      for (const paperId of mappedPaperIds) {
        paperIds.add(paperId);
      }
    }
    return Array.from(paperIds);
  }

  protected onItemLoad(paper: Paper): void {
    this.syncConsultationMap(paper);
    this.syncFileMap(paper);
  }

  protected onItemAdd(paper: Paper): void {
    this.syncConsultationMap(paper);
    this.syncFileMap(paper);
    this.handleFileUpdates(paper);
    this.updatedPaperIds.add(paper.id);
  }

  private handleFileUpdates(paper: Paper): void {
    if (!paper.auxiliaryFile) return;

    const fileContentsStore = store.fileContentStore;

    for (const file of paper.auxiliaryFile) {
      const nextFile: FileContentType = {
        id: file.id,
        downloadUrl: file.downloadUrl,
        fileModified: file.modified,
      };
      fileContentsStore.upsertFromPaperFile(nextFile);
    }
  }

  private syncConsultationMap(paper: Paper): void {
    const previousConsultations = this.paperConsultations.get(paper.id) ?? new Set<string>();
    const nextConsultations = new Set(
      (paper.consultation ?? []).map((consultation) => consultation.id),
    );

    for (const consultationId of previousConsultations) {
      if (
        !nextConsultations.has(consultationId) &&
        this.consultationPapers.get(consultationId) === paper.id
      ) {
        this.consultationPapers.delete(consultationId);
      }
    }

    for (const consultationId of nextConsultations) {
      this.consultationPapers.set(consultationId, paper.id);
    }

    if (nextConsultations.size > 0) {
      this.paperConsultations.set(paper.id, nextConsultations);
    } else {
      this.paperConsultations.delete(paper.id);
    }
  }

  private syncFileMap(paper: Paper): void {
    const previousFileIds = this.paperFiles.get(paper.id) ?? new Set<string>();
    const nextFileIds = new Set((paper.auxiliaryFile ?? []).map((file) => file.id));

    for (const fileId of previousFileIds) {
      if (nextFileIds.has(fileId)) continue;

      const mappedPaperIds = this.filePapers.get(fileId);
      if (!mappedPaperIds) continue;

      mappedPaperIds.delete(paper.id);
      if (mappedPaperIds.size === 0) {
        this.filePapers.delete(fileId);
      }
    }

    for (const fileId of nextFileIds) {
      let mappedPaperIds = this.filePapers.get(fileId);
      if (!mappedPaperIds) {
        mappedPaperIds = new Set<string>();
        this.filePapers.set(fileId, mappedPaperIds);
      }
      mappedPaperIds.add(paper.id);
    }

    if (nextFileIds.size > 0) {
      this.paperFiles.set(paper.id, nextFileIds);
    } else {
      this.paperFiles.delete(paper.id);
    }
  }

  clearAllItems(): void {
    super.clearAllItems();
    this.consultationPapers.clear();
    this.paperConsultations.clear();
    this.filePapers.clear();
    this.paperFiles.clear();
    this.updatedPaperIds.clear();
  }
}

export const paperStore = new PaperStore();
