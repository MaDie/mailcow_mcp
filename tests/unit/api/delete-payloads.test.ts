import { JobsAPI } from '../../../src/api/syncjobs';
import { QueuesAPI } from '../../../src/api/queues';

describe('delete payloads confirmed by json_api.php', () => {
  const client = { get: jest.fn(), post: jest.fn() };

  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.post.mockResolvedValue([{ type: 'success', msg: ['Task completed'] }]);
  });

  it('deletes a sync job by sending the id list as the JSON body', async () => {
    await new JobsAPI(client as any).deleteSyncJob(42);
    expect(client.post).toHaveBeenCalledWith('/api/v1/delete/syncjob', ['42']);
  });

  it('deletes queue items by sending the qid list as the JSON body', async () => {
    await new QueuesAPI(client as any).deleteQueueItems(['A1B2C3D4E5', 'F6']);
    expect(client.post).toHaveBeenCalledWith('/api/v1/delete/mailq', [
      'A1B2C3D4E5',
      'F6',
    ]);
  });
});
