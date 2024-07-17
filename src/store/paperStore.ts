import { BaseStore } from './baseStore';
import { Paper } from '../types';
import { readJsonFromFile, writeJsonToFile } from '../fileUtils';

class PaperStore extends BaseStore<Paper> {
  private consultationPapers: Map<string, string> = new Map();

  getFileName(): string {
    return 'paperStore.json';
  }

  addPaper(paper: Paper) {
    super.add(paper);
    if (paper.consultation) {
      paper.consultation.forEach((consultation) => {
        this.consultationPapers.set(consultation.id, paper.id);
      });
    }
  }

  getPaperByConsultationId(consultationId: string): Paper | undefined {
    const paperId = this.consultationPapers.get(consultationId);
    return paperId ? this.getById(paperId) : undefined;
  }

  async saveToDisk(): Promise<void> {
    const data = {
      papers: Array.from(this.items.entries()),
      consultationPapers: Array.from(this.consultationPapers.entries()),
    };
    await writeJsonToFile(data, this.getFileName());
  }

  async loadFromDisk(): Promise<void> {
    const data = await readJsonFromFile(this.getFileName());
    if (data) {
      this.items = new Map(data.papers);
      this.consultationPapers = new Map(data.consultationPapers);
    }
  }
}

export const paperStore = new PaperStore();
