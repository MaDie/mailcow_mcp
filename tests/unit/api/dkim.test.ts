import { DKIMAPI, normalizeDKIMKey } from '../../../src/api/dkim';
import { APIClient } from '../../../src/api/client';

const MAILCOW_DKIM = {
  dkim_selector: 'dkim',
  key_length: '2048',
  dkim_txt: 'v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A',
};

describe('normalizeDKIMKey', () => {
  it('maps Mailcow get/dkim fields onto MailcowDKIM', () => {
    const key = normalizeDKIMKey('example.com', MAILCOW_DKIM);

    expect(key).toMatchObject({
      domain: 'example.com',
      selector: 'dkim',
      key_size: 2048,
      algorithm: 'rsa',
      public_key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A',
      dkim_txt: MAILCOW_DKIM.dkim_txt,
      active: true,
    });
  });

  it('returns null for empty Mailcow objects', () => {
    expect(normalizeDKIMKey('example.com', {})).toBeNull();
  });
});

describe('DKIMAPI', () => {
  let client: jest.Mocked<APIClient>;
  let api: DKIMAPI;

  beforeEach(() => {
    client = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;
    api = new DKIMAPI(client);
  });

  it('lists keys by querying /get/dkim/<domain> for each domain', async () => {
    client.get
      .mockResolvedValueOnce([
        { domain_name: 'example.com' },
        { domain_name: 'test.org' },
      ])
      .mockResolvedValueOnce(MAILCOW_DKIM)
      .mockResolvedValueOnce({});

    const keys = await api.listDKIMKeys();

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/v1/get/domain/all');
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/v1/get/dkim/example.com');
    expect(client.get).toHaveBeenNthCalledWith(3, '/api/v1/get/dkim/test.org');
    expect(keys).toHaveLength(1);
    expect(keys[0].domain).toBe('example.com');
    expect(Array.isArray(keys)).toBe(true);
  });

  it('queries only the requested domain', async () => {
    client.get.mockResolvedValue(MAILCOW_DKIM);

    const keys = await api.listDKIMKeys({ domain: 'example.com' });

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith('/api/v1/get/dkim/example.com');
    expect(keys[0].selector).toBe('dkim');
  });

  it('gets a key from /get/dkim/<domain>', async () => {
    client.get.mockResolvedValue(MAILCOW_DKIM);

    const key = await api.getDKIMKey('example.com', 'dkim');

    expect(client.get).toHaveBeenCalledWith('/api/v1/get/dkim/example.com');
    expect(key?.selector).toBe('dkim');
  });

  it('returns the Mailcow TXT record instead of composing k=undefined', () => {
    const key = normalizeDKIMKey('example.com', MAILCOW_DKIM)!;
    expect(api.generateDKIMDNSRecord(key)).toBe(MAILCOW_DKIM.dkim_txt);
    expect(api.generateDKIMDNSRecord(key)).not.toContain('k=undefined');
    expect(api.validateDKIMKey(key)).toBe(true);
  });

  it('refetches the key after create so the domain name is present', async () => {
    client.post.mockResolvedValue([{ type: 'success', msg: ['dkim_added'] }]);
    client.get.mockResolvedValue(MAILCOW_DKIM);

    const created = await api.createDKIMKey({
      domain: 'example.com',
      selector: 'dkim',
    });

    expect(created.domain).toBe('example.com');
    expect(created.selector).toBe('dkim');
  });
});
