import { PerRecordStore } from './per-record-store.js';
import { Paper } from '../types/index.js';
import { stores } from './index.js';
import { FileContent } from '../types/file-content.js';

export class PaperStore extends PerRecordStore<Paper> {
  private paperIdByConsultationId: Map<string, string> = new Map();
  private consultationIdsByPaperId: Map<string, Set<string>> = new Map();
  private paperIdsByFileId: Map<string, Set<string>> = new Map();
  private fileIdsByPaperId: Map<string, Set<string>> = new Map();
  private updatedPaperIds: Set<string> = new Set();

  readonly storageFileName = 'papers.json';
  readonly recordDirectoryName = 'papers';

  getIncrementalSyncStart(): Date | undefined {
    return this.findLatestTimestamp(1); // Include one overlapping day for safety.
  }

  getPaperByConsultationId(consultationId: string): Paper | undefined {
    const paperId = this.paperIdByConsultationId.get(consultationId);
    return paperId ? this.getById(paperId) : undefined;
  }

  drainUpdatedPaperIds(): string[] {
    const ids = Array.from(this.updatedPaperIds);
    this.updatedPaperIds.clear();
    return ids;
  }

  getPaperIdsByFileIds(fileIds: Iterable<string>): string[] {
    const paperIds = new Set<string>();
    for (const fileId of fileIds) {
      const mappedPaperIds = this.paperIdsByFileId.get(fileId);
      if (!mappedPaperIds) continue;
      for (const paperId of mappedPaperIds) {
        paperIds.add(paperId);
      }
    }
    return Array.from(paperIds);
  }

  protected onItemLoad(paper: Paper): void {
    this.reindexConsultations(paper);
    this.reindexFiles(paper);
  }

  protected onItemAdd(paper: Paper): void {
    this.reindexConsultations(paper);
    this.reindexFiles(paper);
    this.registerAuxiliaryFileContents(paper);
    this.updatedPaperIds.add(paper.id);
  }

  protected onItemRemove(paper: Paper): void {
    this.removePaperFromIndexes(paper.id);
    this.updatedPaperIds.add(paper.id);
  }

  private removePaperFromIndexes(paperId: string): void {
    for (const consultationId of this.consultationIdsByPaperId.get(paperId) ?? []) {
      if (this.paperIdByConsultationId.get(consultationId) === paperId) {
        this.paperIdByConsultationId.delete(consultationId);
      }
    }
    this.consultationIdsByPaperId.delete(paperId);

    for (const fileId of this.fileIdsByPaperId.get(paperId) ?? []) {
      const paperIds = this.paperIdsByFileId.get(fileId);
      paperIds?.delete(paperId);
      if (paperIds?.size === 0) this.paperIdsByFileId.delete(fileId);
    }
    this.fileIdsByPaperId.delete(paperId);
  }

  private registerAuxiliaryFileContents(paper: Paper): void {
    if (!paper.auxiliaryFile) return;

    const fileContentStore = stores.fileContents;

    for (const file of paper.auxiliaryFile) {
      const fileContent: FileContent = {
        id: file.id,
        downloadUrl: file.downloadUrl,
        fileModified: file.modified,
      };
      fileContentStore.upsertFileMetadata(fileContent);
    }
  }

  private reindexConsultations(paper: Paper): void {
    const previousConsultations = this.consultationIdsByPaperId.get(paper.id) ?? new Set<string>();
    const nextConsultations = new Set(
      (paper.consultation ?? []).map((consultation) => consultation.id),
    );

    for (const consultationId of previousConsultations) {
      if (
        !nextConsultations.has(consultationId) &&
        this.paperIdByConsultationId.get(consultationId) === paper.id
      ) {
        this.paperIdByConsultationId.delete(consultationId);
      }
    }

    for (const consultationId of nextConsultations) {
      this.paperIdByConsultationId.set(consultationId, paper.id);
    }

    if (nextConsultations.size > 0) {
      this.consultationIdsByPaperId.set(paper.id, nextConsultations);
    } else {
      this.consultationIdsByPaperId.delete(paper.id);
    }
  }

  private reindexFiles(paper: Paper): void {
    const previousFileIds = this.fileIdsByPaperId.get(paper.id) ?? new Set<string>();
    const nextFileIds = new Set((paper.auxiliaryFile ?? []).map((file) => file.id));

    for (const fileId of previousFileIds) {
      if (nextFileIds.has(fileId)) continue;

      const mappedPaperIds = this.paperIdsByFileId.get(fileId);
      if (!mappedPaperIds) continue;

      mappedPaperIds.delete(paper.id);
      if (mappedPaperIds.size === 0) {
        this.paperIdsByFileId.delete(fileId);
      }
    }

    for (const fileId of nextFileIds) {
      let mappedPaperIds = this.paperIdsByFileId.get(fileId);
      if (!mappedPaperIds) {
        mappedPaperIds = new Set<string>();
        this.paperIdsByFileId.set(fileId, mappedPaperIds);
      }
      mappedPaperIds.add(paper.id);
    }

    if (nextFileIds.size > 0) {
      this.fileIdsByPaperId.set(paper.id, nextFileIds);
    } else {
      this.fileIdsByPaperId.delete(paper.id);
    }
  }

  clear(): void {
    super.clear();
    this.paperIdByConsultationId.clear();
    this.consultationIdsByPaperId.clear();
    this.paperIdsByFileId.clear();
    this.fileIdsByPaperId.clear();
    this.updatedPaperIds.clear();
  }
}

export const paperStore = new PaperStore();
