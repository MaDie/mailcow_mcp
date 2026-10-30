import {
  buildDomainEndpoint,
  buildMailboxEndpoint,
  buildDKIMEndpoint,
} from '../../../src/api/endpoints';
import { APIAction } from '../../../src/types/api';

describe('endpoint builder GET actions', () => {
  it('builds domain GET with and without an id', () => {
    expect(buildDomainEndpoint(APIAction.GET)).toBe('/api/v1/get/domain');
    expect(buildDomainEndpoint(APIAction.GET, 'example.com')).toBe(
      '/api/v1/get/domain/example.com'
    );
  });

  it('builds mailbox GET including encoded usernames', () => {
    expect(buildMailboxEndpoint(APIAction.GET)).toBe('/api/v1/get/mailbox');
    expect(buildMailboxEndpoint(APIAction.GET, 'info@example.com')).toBe(
      '/api/v1/get/mailbox/info%40example.com'
    );
  });

  it('builds DKIM GET for a domain', () => {
    expect(buildDKIMEndpoint(APIAction.GET, 'example.com')).toBe(
      '/api/v1/get/dkim/example.com'
    );
  });

  it('keeps list/create/update/delete paths', () => {
    expect(buildDomainEndpoint(APIAction.LIST)).toBe('/api/v1/get/domain/all');
    expect(buildMailboxEndpoint(APIAction.CREATE)).toBe('/api/v1/add/mailbox');
    expect(buildDKIMEndpoint(APIAction.DELETE)).toBe('/api/v1/delete/dkim');
  });
});
