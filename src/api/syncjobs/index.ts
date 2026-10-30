import { APIClient } from '../client';
import { 
  MailcowSyncJob, 
  ListSyncJobsParams, 
  CreateSyncJobRequest, 
  UpdateSyncJobRequest 
} from '../../types';
import { APIAction } from '../../types/api';
import { buildSyncJobEndpoint } from '../endpoints';
import { asObjectList, mailcowDeleteItems } from '../mailcow-response';

export class JobsAPI {
  constructor(private client: APIClient) {}

  async listSyncJobs(
    params?: ListSyncJobsParams & { username?: string }
  ): Promise<MailcowSyncJob[]> {
    const username = params?.username;
    const path = username
      ? buildSyncJobEndpoint(APIAction.GET, username)
      : buildSyncJobEndpoint(APIAction.LIST);
    return asObjectList<MailcowSyncJob>(await this.client.get<unknown>(path));
  }

  async createSyncJob(job: CreateSyncJobRequest): Promise<MailcowSyncJob> {
    return this.client.post<MailcowSyncJob>(
      buildSyncJobEndpoint(APIAction.CREATE),
      job
    );
  }

  async updateSyncJob(jobId: number, updates: UpdateSyncJobRequest): Promise<MailcowSyncJob> {
    const payload = { ...updates, id: jobId };
    return this.client.post<MailcowSyncJob>(
      buildSyncJobEndpoint(APIAction.UPDATE),
      payload
    );
  }

  async deleteSyncJob(jobId: number): Promise<void> {
    await this.client.post<void>(
      buildSyncJobEndpoint(APIAction.DELETE),
      mailcowDeleteItems([jobId])
    );
  }

  async getSyncJobDetails(jobId: number): Promise<MailcowSyncJob> {
    // Job ids are not a GET object; list all (no_log) and pick the row.
    const jobs = asObjectList<MailcowSyncJob>(
      await this.client.get<unknown>(buildSyncJobEndpoint(APIAction.LIST))
    );
    const job = jobs.find((j) => Number(j.id) === Number(jobId));
    if (!job) {
      throw new Error(`Sync job not found: ${jobId}`);
    }
    return job;
  }

  async activateSyncJob(jobId: number): Promise<MailcowSyncJob> {
    return this.updateSyncJob(jobId, { active: true });
  }

  async deactivateSyncJob(jobId: number): Promise<MailcowSyncJob> {
    return this.updateSyncJob(jobId, { active: false });
  }
} 