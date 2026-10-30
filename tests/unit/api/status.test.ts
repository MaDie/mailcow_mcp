import { StatusAPI } from '../../../src/api/status';
import { API_ENDPOINTS } from '../../../src/api/endpoints';

describe('StatusAPI', () => {
  const get = jest.fn();
  const client = { get } as any;

  beforeEach(() => {
    get.mockReset();
  });

  it('uses GET /api/v1/get/status/version', async () => {
    get.mockResolvedValue({ version: '2026-09' });

    const status = await new StatusAPI(client).getVersion();

    expect(get).toHaveBeenCalledWith(API_ENDPOINTS.STATUS.VERSION);
    expect(status).toMatchObject({
      reachable: true,
      version: '2026-09',
      matches_tested: true,
      warning: null,
    });
  });

  it('warns when the connected monthly release differs', async () => {
    get.mockResolvedValue({ version: '2025-03' });

    const status = await new StatusAPI(client).getVersion();

    expect(status.matches_tested).toBe(false);
    expect(status.warning).toMatch(/2025-03/);
  });

  it('reports an unreachable host without throwing', async () => {
    get.mockRejectedValue(new Error('API Error 401: Unauthorized'));

    const status = await new StatusAPI(client).getVersion();

    expect(status.reachable).toBe(false);
    expect(status.version).toBeNull();
    expect(status.error).toMatch(/401/);
    expect(status.warning).toMatch(/status\/version/);
  });
});
