import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AdminService } from './admin.service';
import { ImportStepName } from '@mealy/types';

interface ImportJobData {
  jobId: string;
  url: string;
  force?: boolean;
}

@Processor('import', { concurrency: 2 })
export class ImportJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportJobProcessor.name);

  constructor(private readonly adminService: AdminService) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<void> {
    const { jobId, url, force } = job.data;
    let currentStep: ImportStepName = 'fetch';

    try {
      const recipe = await this.adminService.executePipeline(
        url,
        force,
        (event) => {
          currentStep = event.step;
          if ('subStep' in event) {
            // Sub-step event — update the matching sub-step within the parent step
            this.adminService.updateJobSnapshot(jobId, (s) => ({
              ...s,
              steps: s.steps.map((st) =>
                st.step === event.step
                  ? {
                      ...st,
                      subSteps: st.subSteps.map((ss) =>
                        ss.name === event.subStep
                          ? {
                              ...ss,
                              status: event.status,
                              message: event.message ?? ss.message,
                            }
                          : ss,
                      ),
                    }
                  : st,
              ),
            }));
          } else {
            // Step-level event — update the step itself
            this.adminService.updateJobSnapshot(jobId, (s) => ({
              ...s,
              jobStatus: 'running',
              steps: s.steps.map((st) =>
                st.step === event.step
                  ? { ...st, status: event.status, message: event.message }
                  : st,
              ),
            }));
          }
        },
        jobId,
      );

      this.adminService.updateJobSnapshot(jobId, (s) => ({
        ...s,
        jobStatus: 'done',
        result: { id: recipe.id, title: recipe.title },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Import job ${jobId} failed at step "${currentStep}" for URL ${url}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      this.adminService.updateJobSnapshot(jobId, (s) => ({
        ...s,
        jobStatus: 'error',
        steps: s.steps.map((st) =>
          st.step === currentStep ? { ...st, status: 'error', message } : st,
        ),
      }));
    } finally {
      setTimeout(
        () => this.adminService.cleanupSnapshot(jobId),
        10 * 60 * 1000,
      ).unref();
    }
  }
}
