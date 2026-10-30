import { FilterAPI } from '../../../src/api/filters';
import { MailcowAPIError } from '../../../src/api/mailcow-response';

describe('FilterAPI', () => {
  let client: { get: jest.Mock; post: jest.Mock };
  let api: FilterAPI;

  beforeEach(() => {
    client = { get: jest.fn(), post: jest.fn() };
    api = new FilterAPI(client as any);
  });

  it('lists all filters from /get/filters/all', async () => {
    client.get.mockResolvedValue([
      {
        id: 3,
        username: 'user@example.com',
        script_desc: 'Drop exe',
        script_data: 'discard;',
        filter_type: 'prefilter',
        active: 1,
      },
    ]);

    const filters = await api.listFilters();
    expect(client.get).toHaveBeenCalledWith('/api/v1/get/filters/all');
    expect(filters[0]).toMatchObject({
      id: 3,
      username: 'user@example.com',
      active: true,
      filter_type: 'prefilter',
    });
  });

  it('lists mailbox filters from /get/filters/<username>', async () => {
    client.get.mockResolvedValue([]);
    await api.listFilters({ username: 'user@example.com' });
    expect(client.get).toHaveBeenCalledWith('/api/v1/get/filters/user%40example.com');
  });

  it('creates via /add/filter and refetches the mailbox filters', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['mailbox_modified', 'user@example.com'] }]);
    client.get.mockResolvedValue([
      {
        id: 9,
        username: 'user@example.com',
        script_desc: 'Mine',
        script_data: 'keep;',
        filter_type: 'prefilter',
        active: '1',
      },
    ]);

    const created = await api.createFilter({
      username: 'user@example.com',
      script_desc: 'Mine',
      script_data: 'keep;',
    });

    expect(client.post).toHaveBeenCalledWith('/api/v1/add/filter', {
      username: 'user@example.com',
      script_desc: 'Mine',
      script_data: 'keep;',
      filter_type: 'prefilter',
      active: '1',
    });
    expect(created.id).toBe(9);
  });

  it('edits a filter with items/attr and deletes with a plain id array', async () => {
    client.get.mockResolvedValue([
      {
        id: 9,
        username: 'user@example.com',
        script_desc: 'Mine',
        script_data: 'keep;',
        filter_type: 'prefilter',
        active: '1',
      },
    ]);
    client.post.mockResolvedValue([{ type: 'success', msg: ['mailbox_modified'] }]);

    await api.updateFilter('9', { script_desc: 'Renamed', active: false });
    expect(client.post).toHaveBeenCalledWith('/api/v1/edit/filter', {
      items: ['9'],
      attr: {
        script_desc: 'Renamed',
        script_data: 'keep;',
        filter_type: 'prefilter',
        active: '0',
      },
    });

    await api.deleteFilter('9');
    expect(client.post).toHaveBeenCalledWith('/api/v1/delete/filter', ['9']);
  });

  it('fails create when the filter is missing after a success response', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['mailbox_modified'] }]);
    client.get.mockResolvedValue([]);

    await expect(
      api.createFilter({
        username: 'user@example.com',
        script_desc: 'Gone',
        script_data: 'keep;',
      })
    ).rejects.toThrow(MailcowAPIError);
  });
});
