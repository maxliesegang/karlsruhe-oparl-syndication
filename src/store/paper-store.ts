import { BaseStore } from './base-store';
import { Paper } from '../types';
import { store } from './index';
import { FileContentType } from '../types/file-content-type';

class PaperStore extends BaseStore<Paper> {
  private consultationPapers: Map<string, string> = new Map();

  getFileName(): string {
    return 'papers.json';
  }

  getLastModified(): Date | undefined {
    const allDates = Array.from(this.itemStore.values()).map((item) =>
      item.modified ? new Date(item.modified) : new Date(item.created),
    );
    return allDates.length
      ? new Date(Math.max(...allDates.map((date) => date.getTime())))
      : undefined;
  }

  getPaperByConsultationId(consultationId: string): Paper | undefined {
    const paperId = this.consultationPapers.get(consultationId);
    return paperId ? this.getById(paperId) : undefined;
  }

  protected async onItemLoad(paper: Paper): Promise<void> {
    this.updateConsultationMap(paper);
  }

  protected async onItemAdd(paper: Paper) {
    this.updateConsultationMap(paper);
    this.handleFileUpdates(paper);
  }

  private handleFileUpdates(paper: Paper): void {
    if (!paper.auxiliaryFile) return;

    const fileContentsStore = store.fileContentStore;

    paper.auxiliaryFile.forEach((file) => {
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
    });
  }

  private updateConsultationMap(paper: Paper): void {
    if (paper.consultation) {
      paper.consultation.forEach((consultation) => {
        this.consultationPapers.set(consultation.id, paper.id);
      });
    }
  }
}

export const paperStore = new PaperStore();
