export const DOMAIN_PATTERN =
  '^[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])*$';

export const EMAIL_PATTERN =
  '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';

/** Mailbox alias or catch-all `@domain.tld`. */
export const ALIAS_ADDRESS_PATTERN =
  '^(@|[a-zA-Z0-9._%+-]+@)[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
