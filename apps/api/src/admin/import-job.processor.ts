import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AdminService, ImportStepName } from './admin.service';

interface ImportJobData {
  jobId: string;
  url: string;
}

@Processor('import', { concurrency: 2 })
export class ImportJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportJobProcessor.name);

  constructor(private readonly adminService: AdminService) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<void> {
    const { jobId, url } = job.data;
    const subject = this.adminService.getSubject(jobId);
    let currentStep: ImportStepName = 'fetch';

    try {
      await this.adminService.executePipeline(url, (event) => {
        if (event.status === 'running') currentStep = event.step;
        subject.next({ ...event, jobId, url });
      });
      subject.complete();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Import job ${jobId} failed at step "${currentStep}" for URL ${url}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      subject.next({
        jobId,
        url,
        step: currentStep,
        status: 'error',
        message,
      });
      subject.complete();
    } finally {
      setTimeout(() => this.adminService.cleanupSubject(jobId), 10 * 60 * 1000);
    }
  }
}
