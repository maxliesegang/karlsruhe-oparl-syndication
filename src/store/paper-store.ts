import { PerRecordStore } from './per-record-store.js';
import { Paper } from '../types/index.js';
import { stores } from './index.js';
import { FileContent } from '../types/file-content.js';
import { ReferenceIndex, ExclusiveReferenceIndex } from './reference-index.js';

export class PaperStore extends PerRecordStore<Paper> {
  /** Consultation id -> paper; the API gives each consultation exactly one paper. */
  private readonly consultationIndex = new ExclusiveReferenceIndex();
  /** Attachment file id -> papers; one file can be attached to several papers. */
  private readonly fileIndex = new ReferenceIndex();
  private updatedPaperIds: Set<string> = new Set();

  readonly storageFileName = 'papers.json';
  readonly recordDirectoryName = 'papers';

  getIncrementalSyncStart(): Date | undefined {
    return this.findLatestTimestamp(1); // Include one overlapping day for safety.
  }

  getPaperByConsultationId(consultationId: string): Paper | undefined {
    const paperId = this.consultationIndex.getReferrer(consultationId);
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
      for (const paperId of this.fileIndex.getReferrers(fileId) ?? []) {
        paperIds.add(paperId);
      }
    }
    return Array.from(paperIds);
  }

  protected onItemLoad(paper: Paper): void {
    this.reindex(paper);
  }

  protected onItemAdd(paper: Paper): void {
    this.reindex(paper);
    this.registerAuxiliaryFileContents(paper);
    this.updatedPaperIds.add(paper.id);
  }

  protected onItemRemove(paper: Paper): void {
    this.consultationIndex.removeReferrer(paper.id);
    this.fileIndex.removeReferrer(paper.id);
    this.updatedPaperIds.add(paper.id);
  }

  private reindex(paper: Paper): void {
    this.consultationIndex.setReferences(
      paper.id,
      (paper.consultation ?? []).map((consultation) => consultation.id),
    );
    this.fileIndex.setReferences(
      paper.id,
      (paper.auxiliaryFile ?? []).map((file) => file.id),
    );
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

  clear(): void {
    super.clear();
    this.consultationIndex.clear();
    this.fileIndex.clear();
    this.updatedPaperIds.clear();
  }
}

export const paperStore = new PaperStore();
