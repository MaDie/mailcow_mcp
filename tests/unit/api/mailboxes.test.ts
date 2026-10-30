import { MailboxAPI } from '../../../src/api/mailboxes';
import { APIClient } from '../../../src/api/client';
import { MailcowAPIError } from '../../../src/api/mailcow-response';

describe('MailboxAPI', () => {
  let client: jest.Mocked<APIClient>;
  let api: MailboxAPI;

  beforeEach(() => {
    client = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;
    api = new MailboxAPI(client);
  });

  it('gets a mailbox via /get/mailbox/<username>', async () => {
    client.get.mockResolvedValue({
      username: 'info@example.com',
      domain: 'example.com',
      local_part: 'info',
    });

    const mailbox = await api.getMailboxDetails('info@example.com');

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/mailbox/info%40example.com');
    expect(mailbox.username).toBe('info@example.com');
  });

  it('sends password2 when creating a mailbox and refetches it', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['mailbox_added'] }]);
    client.get.mockResolvedValue({
      username: 'info@example.com',
      domain: 'example.com',
      local_part: 'info',
    });

    const created = await api.createMailbox({
      local_part: 'info',
      domain: 'example.com',
      password: 'secret-pass',
      quota: 1000,
    });

    expect(client.post).toHaveBeenCalledWith('/api/v1/add/mailbox', {
      local_part: 'info',
      domain: 'example.com',
      password: 'secret-pass',
      password2: 'secret-pass',
      quota: 1000,
    });
    expect(created.username).toBe('info@example.com');
  });

  it('throws when Mailcow reports type danger instead of claiming success', async () => {
    client.post.mockRejectedValue(
      new MailcowAPIError('Mailcow API error: mailbox_invalid: info@example.com', [
        { type: 'danger', msg: ['mailbox_invalid', 'info@example.com'] },
      ])
    );

    await expect(
      api.createMailbox({
        local_part: 'info',
        domain: 'example.com',
        password: 'x',
        quota: 1,
      })
    ).rejects.toThrow(/mailbox_invalid/);
    expect(client.get).not.toHaveBeenCalled();
  });
});
