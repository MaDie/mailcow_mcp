import { JobsAPI } from '../../../src/api/syncjobs';
import { QueuesAPI } from '../../../src/api/queues';
import { DKIMAPI } from '../../../src/api/dkim';
import {
  API_ENDPOINTS,
  buildSyncJobEndpoint,
  buildQueueEndpoint,
  buildDKIMEndpoint,
} from '../../../src/api/endpoints';
import { APIAction } from '../../../src/types/api';

function mockClient() {
  return {
    get: jest.fn(),
    post: jest.fn(),
  };
}

describe('source-verified Mailcow paths and bodies (2026.9.2)', () => {
  it('builds GET /syncjobs/all/no_log and the per-mailbox variant', () => {
    expect(API_ENDPOINTS.SYNCJOBS.LIST).toBe('/api/v1/get/syncjobs/all/no_log');
    expect(buildSyncJobEndpoint(APIAction.LIST)).toBe(
      '/api/v1/get/syncjobs/all/no_log'
    );
    expect(buildSyncJobEndpoint(APIAction.GET)).toBe(
      '/api/v1/get/syncjobs/all/no_log'
    );
    expect(buildSyncJobEndpoint(APIAction.GET, 'info@example.com')).toBe(
      '/api/v1/get/syncjobs/info%40example.com/no_log'
    );
  });

  it('lists sync jobs at GET /api/v1/get/syncjobs/all/no_log', async () => {
    const client = mockClient();
    client.get.mockResolvedValue([{ id: 1, username: 'info@example.com' }]);

    const jobs = await new JobsAPI(client as any).listSyncJobs();

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/syncjobs/all/no_log');
    expect(jobs).toHaveLength(1);
  });

  it('lists sync jobs for a mailbox at GET /syncjobs/{mailbox}/no_log', async () => {
    const client = mockClient();
    client.get.mockResolvedValue([{ id: 7 }]);

    await new JobsAPI(client as any).listSyncJobs({
      username: 'info@example.com',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/api/v1/get/syncjobs/info%40example.com/no_log'
    );
  });

  it('gets a sync job by listing all/no_log then matching id', async () => {
    const client = mockClient();
    client.get.mockResolvedValue([
      { id: '1' },
      { id: 42, username: 'info@example.com' },
    ]);

    const job = await new JobsAPI(client as any).getSyncJobDetails(42);

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/syncjobs/all/no_log');
    expect(job.id).toBe(42);
  });

  it('builds GET /mailq/all for list and get', () => {
    expect(buildQueueEndpoint(APIAction.LIST)).toBe('/api/v1/get/mailq/all');
    expect(buildQueueEndpoint(APIAction.GET)).toBe('/api/v1/get/mailq/all');
  });

  it('lists and gets queue items at GET /api/v1/get/mailq/all', async () => {
    const client = mockClient();
    client.get.mockResolvedValue([
      { id: 'A1B2C3D4E5', queue_id: 'A1B2C3D4E5', sender: 'a@b.c' },
    ]);
    const api = new QueuesAPI(client as any);

    await api.listQueueItems();
    expect(client.get).toHaveBeenCalledWith('/api/v1/get/mailq/all');

    const item = await api.getQueueItemDetails('A1B2C3D4E5');
    expect(client.get).toHaveBeenLastCalledWith('/api/v1/get/mailq/all');
    expect(item.id).toBe('A1B2C3D4E5');
  });

  it('releases a queue item with { items, attr: { action: unhold } }', async () => {
    const client = mockClient();
    client.post.mockResolvedValue([{ type: 'success', msg: ['queue_command_success'] }]);

    await new QueuesAPI(client as any).releaseQueueItem('A1B2C3D4E5');

    expect(client.post).toHaveBeenCalledWith('/api/v1/edit/mailq', {
      items: ['A1B2C3D4E5'],
      attr: { action: 'unhold' },
    });
  });

  it('holds a queue item with { items, attr: { action: hold } }', async () => {
    const client = mockClient();
    client.post.mockResolvedValue([{ type: 'success', msg: ['queue_command_success'] }]);

    await new QueuesAPI(client as any).holdQueueItem('A1B2C3D4E5');

    expect(client.post).toHaveBeenCalledWith('/api/v1/edit/mailq', {
      items: ['A1B2C3D4E5'],
      attr: { action: 'hold' },
    });
  });

  it('creates a DKIM key with domains + dkim_selector + key_size', async () => {
    const client = mockClient();
    client.post.mockResolvedValue([{ type: 'success', msg: ['dkim_added'] }]);
    client.get.mockResolvedValue({
      dkim_selector: 'mail',
      key_length: '2048',
      dkim_txt: 'v=DKIM1;k=rsa;p=ABC',
    });

    await new DKIMAPI(client as any).createDKIMKey({
      domain: 'example.com',
      selector: 'mail',
    });

    expect(client.post).toHaveBeenCalledWith('/api/v1/add/dkim', {
      domains: 'example.com',
      dkim_selector: 'mail',
      key_size: 2048,
    });
  });

  it('does not expose /edit/dkim or /user routes', () => {
    expect(API_ENDPOINTS).not.toHaveProperty('USERS');
    expect(buildDKIMEndpoint(APIAction.CREATE)).toBe('/api/v1/add/dkim');
    expect(buildDKIMEndpoint(APIAction.DELETE)).toBe('/api/v1/delete/dkim');
    expect(() =>
      buildDKIMEndpoint(APIAction.UPDATE as typeof APIAction.CREATE)
    ).toThrow(/Unknown DKIM action/);
  });
});
