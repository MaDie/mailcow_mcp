import { AliasAPI } from '../../../src/api/aliases';
import { MailcowAPIError } from '../../../src/api/mailcow-response';

describe('AliasAPI', () => {
  let client: { get: jest.Mock; post: jest.Mock };
  let api: AliasAPI;

  beforeEach(() => {
    client = { get: jest.fn(), post: jest.fn() };
    api = new AliasAPI(client as any);
  });

  it('lists aliases from /get/alias/all', async () => {
    client.get.mockResolvedValue([
      { id: 6, address: 'alias@example.com', goto: 'user@example.com', domain: 'example.com', active: '1' },
    ]);

    const aliases = await api.listAliases();

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/alias/all');
    expect(aliases[0]).toMatchObject({
      id: 6,
      address: 'alias@example.com',
      active: true,
    });
  });

  it('sends Mailcow flags and verifies alias_added before returning', async () => {
    client.post.mockResolvedValue([
      { type: 'success', msg: ['alias_added', 'info@example.com', '12'] },
    ]);
    client.get.mockResolvedValue({
      id: 12,
      address: 'info@example.com',
      goto: 'user@example.com',
      domain: 'example.com',
      active: '1',
      sogo_visible: '1',
    });

    const created = await api.createAlias({
      address: 'info@example.com',
      goto: 'user@example.com',
    });

    expect(client.post).toHaveBeenCalledWith('/api/v1/add/alias', {
      address: 'info@example.com',
      goto: 'user@example.com',
      active: '1',
      sogo_visible: '1',
    });
    expect(client.get).toHaveBeenCalledWith('/api/v1/get/alias/12');
    expect(created.address).toBe('info@example.com');
    expect(created.active).toBe(true);
  });

  it('fails when Mailcow reports success without alias_added', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['mailbox_modified'] }]);

    await expect(
      api.createAlias({ address: 'a@example.com', goto: 'b@example.com' })
    ).rejects.toThrow(MailcowAPIError);
    expect(client.get).not.toHaveBeenCalled();
  });

  it('updates with items/attr and deletes with items', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['alias_modified'] }]);
    client.get.mockResolvedValue({
      id: 6,
      address: 'alias@example.com',
      goto: 'new@example.com',
      domain: 'example.com',
      active: '0',
    });

    await api.updateAlias('6', { goto: 'new@example.com', active: false });
    expect(client.post).toHaveBeenCalledWith('/api/v1/edit/alias', {
      items: ['6'],
      attr: { goto: 'new@example.com', active: '0' },
    });

    await api.deleteAlias('6');
    expect(client.post).toHaveBeenCalledWith('/api/v1/delete/alias', { items: ['6'] });
  });
});
