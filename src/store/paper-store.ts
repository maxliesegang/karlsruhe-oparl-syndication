import { BaseStore } from './base-store';
import { Paper } from '../types';
import { store } from './index';
import { FileContentType } from '../types/file-content-type';

class PaperStore extends BaseStore<Paper> {
  private consultationPapers: Map<string, string> = new Map();

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

  protected onItemLoad(paper: Paper): void {
    this.updateConsultationMap(paper);
  }

  protected onItemAdd(paper: Paper): void {
    this.updateConsultationMap(paper);
    this.handleFileUpdates(paper);
  }

  private handleFileUpdates(paper: Paper): void {
    if (!paper.auxiliaryFile) return;

    const fileContentsStore = store.fileContentStore;

    for (const file of paper.auxiliaryFile) {
      const existingFile = fileContentsStore.getById(file.id);
      if (existingFile) {
        existingFile.downloadUrl = file.downloadUrl;
        existingFile.fileModified = file.modified;
      } else {
        const newFile: FileContentType = {
          id: file.id,
          downloadUrl: file.downloadUrl,
          fileModified: file.modified,
        };
        fileContentsStore.add(newFile);
      }
    }
  }

  private updateConsultationMap(paper: Paper): void {
    if (paper.consultation) {
      for (const consultation of paper.consultation) {
        this.consultationPapers.set(consultation.id, paper.id);
      }
    }
  }
}

export const paperStore = new PaperStore();
