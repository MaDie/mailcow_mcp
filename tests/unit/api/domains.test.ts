import { DomainAPI } from '../../../src/api/domains';
import { APIClient } from '../../../src/api/client';
import { MailcowAPIError } from '../../../src/api/mailcow-response';

describe('DomainAPI', () => {
  let client: jest.Mocked<APIClient>;
  let api: DomainAPI;

  beforeEach(() => {
    client = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;
    api = new DomainAPI(client);
  });

  it('gets a domain via /get/domain/<name>', async () => {
    client.get.mockResolvedValue({
      domain_name: 'example.com',
      description: 'Main',
      active: 1,
    });

    const domain = await api.getDomainDetails('example.com');

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/domain/example.com');
    expect(domain.domain_name).toBe('example.com');
  });

  it('matches listed domain objects by domain or domain_name', async () => {
    client.get.mockResolvedValue([{ domain: 'example.com', active: 1 }]);

    const domain = await api.getDomainDetails('example.com');
    expect(domain.domain).toBe('example.com');
  });

  it('refetches the domain after create so the name is present', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['domain_added', 'new.com'] }]);
    client.get.mockResolvedValue({ domain_name: 'new.com', active: 1 });

    const created = await api.createDomain({ domain: 'new.com' });

    expect(client.post).toHaveBeenCalledWith('/api/v1/add/domain', { domain: 'new.com' });
    expect(created.domain_name).toBe('new.com');
  });

  it('edits a domain with items/attr and deletes with a plain id array', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['domain_modified'] }]);
    client.get.mockResolvedValue({ domain_name: 'example.com', active: 0 });

    await api.updateDomain('example.com', { description: 'Updated', active: false });
    expect(client.post).toHaveBeenCalledWith('/api/v1/edit/domain', {
      items: ['example.com'],
      attr: { description: 'Updated', active: '0' },
    });

    await api.deleteDomain('example.com');
    expect(client.post).toHaveBeenCalledWith('/api/v1/delete/domain', ['example.com']);
  });

  it('does not treat a danger create response as success', async () => {
    client.post.mockRejectedValue(
      new MailcowAPIError('Mailcow API error: domain_invalid', [
        { type: 'danger', msg: ['domain_invalid'] },
      ])
    );

    await expect(api.createDomain({ domain: 'bad com' })).rejects.toThrow(/domain_invalid/);
    expect(client.get).not.toHaveBeenCalled();
  });
});
