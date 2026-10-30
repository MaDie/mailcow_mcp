import axios from 'axios';
import { APIClient } from '../../../src/api/client';
import { MailcowAPIError } from '../../../src/api/mailcow-response';

jest.mock('axios');

describe('APIClient Mailcow action handling', () => {
  const get = jest.fn();
  const post = jest.fn();
  const put = jest.fn();
  const del = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue({
      get,
      post,
      put,
      delete: del,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });
  });

  function client(): APIClient {
    return new APIClient({ url: 'https://mail.example.com', key: 'k', timeout: 1000 } as any);
  }

  it('returns successful create payloads', async () => {
    const payload = [{ type: 'success', msg: ['mailbox_added', 'a@b.com'] }];
    post.mockResolvedValue({ data: payload });

    await expect(client().post('/api/v1/add/mailbox', {})).resolves.toEqual(payload);
  });

  it('throws when create returns type danger', async () => {
    post.mockResolvedValue({
      data: [{ type: 'danger', msg: ['mailbox_invalid', 'a@b.com'] }],
    });

    await expect(client().post('/api/v1/add/mailbox', {})).rejects.toThrow(MailcowAPIError);
    await expect(client().post('/api/v1/add/mailbox', {})).rejects.toThrow(
      /mailbox_invalid: a@b.com/
    );
  });

  it('throws when create returns type error', async () => {
    post.mockResolvedValue({
      data: [{ type: 'error', msg: ['domain_not_found'] }],
    });

    await expect(client().post('/api/v1/add/domain', {})).rejects.toThrow(
      /domain_not_found/
    );
  });

  it('does not treat domain lists as action errors', async () => {
    get.mockResolvedValue({
      data: [{ domain_name: 'example.com', active: 1 }],
    });

    await expect(client().get('/api/v1/get/domain/all')).resolves.toEqual([
      { domain_name: 'example.com', active: 1 },
    ]);
  });
});
