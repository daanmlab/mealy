import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AdminService } from './admin.service';

interface ImportJobData {
  jobId: string;
  url: string;
}

@Processor('import', { concurrency: 1 })
export class ImportJobProcessor extends WorkerHost {
  constructor(private readonly adminService: AdminService) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<void> {
    const { jobId, url } = job.data;
    const subject = this.adminService.getSubject(jobId);

    try {
      await this.adminService.executePipeline(url, (event) => {
        subject.next({ ...event, jobId, url });
      });
      subject.complete();
    } catch (err) {
      subject.next({
        jobId,
        url,
        step: 'save',
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      subject.complete();
    } finally {
      setTimeout(() => this.adminService.cleanupSubject(jobId), 10 * 60 * 1000);
    }
  }
}
