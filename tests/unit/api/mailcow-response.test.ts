import {
  assertMailcowSuccess,
  extractMailcowActionItems,
  formatMailcowMessage,
  isMailcowActionItem,
  isMailcowFailureType,
  MailcowAPIError,
} from '../../../src/api/mailcow-response';

describe('Mailcow action responses', () => {
  it('recognizes success, danger, error and warning items', () => {
    expect(isMailcowActionItem({ type: 'success', msg: ['ok'] })).toBe(true);
    expect(isMailcowActionItem({ type: 'danger', msg: ['fail'] })).toBe(true);
    expect(isMailcowActionItem({ type: 'error', msg: ['fail'] })).toBe(true);
    expect(isMailcowActionItem({ type: 'warning', msg: ['warn'] })).toBe(true);
    expect(isMailcowActionItem({ domain_name: 'example.com' })).toBe(false);
  });

  it('treats danger and error as failures', () => {
    expect(isMailcowFailureType('danger')).toBe(true);
    expect(isMailcowFailureType('error')).toBe(true);
    expect(isMailcowFailureType('success')).toBe(false);
    expect(isMailcowFailureType('warning')).toBe(false);
  });

  it('formats array and string messages', () => {
    expect(formatMailcowMessage(['mailbox_invalid', 'user@example.com'])).toBe(
      'mailbox_invalid: user@example.com'
    );
    expect(formatMailcowMessage('failed')).toBe('failed');
    expect(formatMailcowMessage(undefined)).toBe('Unknown error');
  });

  it('extracts action arrays and single action objects', () => {
    const items = [{ type: 'success', msg: ['mailbox_added'] }];
    expect(extractMailcowActionItems(items)).toEqual(items);
    expect(extractMailcowActionItems({ type: 'danger', msg: ['nope'] })).toEqual([
      { type: 'danger', msg: ['nope'] },
    ]);
    expect(extractMailcowActionItems([{ domain_name: 'example.com' }])).toBeNull();
    expect(extractMailcowActionItems([])).toBeNull();
  });

  it('ignores domain lists and DKIM objects', () => {
    expect(() =>
      assertMailcowSuccess([{ domain_name: 'example.com', active: 1 }])
    ).not.toThrow();
    expect(() =>
      assertMailcowSuccess({ dkim_selector: 'dkim', dkim_txt: 'v=DKIM1;p=ABC' })
    ).not.toThrow();
  });

  it('allows success and warning action responses', () => {
    expect(() =>
      assertMailcowSuccess([{ type: 'success', msg: ['domain_added', 'new.com'], log: [] }])
    ).not.toThrow();
    expect(() =>
      assertMailcowSuccess([{ type: 'warning', msg: ['already_exists'] }])
    ).not.toThrow();
  });

  it('throws MailcowAPIError for type danger', () => {
    expect(() =>
      assertMailcowSuccess([
        { type: 'danger', msg: ['mailbox_invalid', 'info@example.com'] },
      ])
    ).toThrow(MailcowAPIError);
    expect(() =>
      assertMailcowSuccess([{ type: 'danger', msg: ['domain_invalid'] }])
    ).toThrow(/Mailcow API error: domain_invalid/);
  });

  it('throws MailcowAPIError for type error', () => {
    expect(() =>
      assertMailcowSuccess({ type: 'error', msg: 'permission denied' })
    ).toThrow(/Mailcow API error: permission denied/);
  });
});
