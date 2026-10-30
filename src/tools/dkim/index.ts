/**
 * DKIM Management Tools
 * MCP tools for managing Mailcow DKIM keys
 */

import { BaseTool, ToolUtils } from '../base';
import { DKIMAPI } from '../../api/dkim';
import {
  ToolInput,
  ToolContext,
  ToolHandlerResult,
  CreateDKIMRequest,
  MailcowDKIM,
  ToolCategory,
  MCPErrorCode,
} from '../../types';
import { Logger } from '../../utils';

/** Only include fields Mailcow actually returned (no epoch dates, no key_id 0). */
function dkimListFields(key: MailcowDKIM) {
  return {
    domain: key.domain,
    selector: key.selector,
    algorithm: key.algorithm,
    ...(typeof key.key_size === 'number' && key.key_size > 0 ? { key_size: key.key_size } : {}),
    active: key.active,
    public_key_preview: key.public_key ? `${key.public_key.substring(0, 50)}...` : 'N/A',
    ...(key.created ? { created: key.created } : {}),
    ...(key.modified ? { modified: key.modified } : {}),
    ...(typeof key.id === 'number' && key.id > 0 ? { key_id: key.id } : {}),
  };
}

/**
 * List all DKIM keys
 */
export class ListDKIMKeysTool extends BaseTool {
  readonly name = 'list_dkim_keys';
  readonly description = 'List all DKIM keys in the Mailcow server with optional filtering';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string' as const,
        description: 'Filter by specific domain',
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])*$',
      },
      active_only: {
        type: 'boolean' as const,
        description: 'Only return active DKIM keys',
      },
      selector: {
        type: 'string' as const,
        description: 'Filter by DKIM selector',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 63,
      },
      algorithm: {
        type: 'string' as const,
        description: 'Filter by algorithm (rsa or ed25519)',
        enum: ['rsa', 'ed25519'],
      },
      created_after: {
        type: 'string' as const,
        description: 'Filter by creation date (after this date)',
        format: 'date-time',
      },
      created_before: {
        type: 'string' as const,
        description: 'Filter by creation date (before this date)',
        format: 'date-time',
      },
      limit: {
        type: 'number' as const,
        description: 'Maximum number of DKIM keys to return',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number' as const,
        description: 'Number of DKIM keys to skip for pagination',
        minimum: 0,
      },
    },
    additionalProperties: false,
  };

  constructor(logger: Logger, private dkimAPI: DKIMAPI) {
    super(logger, {
      category: ToolCategory.DOMAIN,
      version: '1.0.0',
      requiresAuth: true,
      rateLimited: true,
    });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);

      // Validate permissions
      if (!this.validatePermissions(context, ['dkim:read', 'domains:read', 'read'])) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.AUTHORIZATION_ERROR,
            message: 'Permission denied: requires dkim:read permission',
          },
        };
      }

      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: `Input validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          },
        };
      }

      const {
        domain,
        active_only = false,
        selector,
        algorithm,
        created_after,
        created_before,
        limit = 100,
        offset = 0,
      } = input;

      // Build API parameters
      const params: any = {};
      if (typeof domain === 'string') params.domain = domain;
      if (active_only) params.active = true;
      if (typeof selector === 'string') params.selector = selector;
      if (typeof algorithm === 'string') params.algorithm = algorithm as 'rsa' | 'ed25519';
      if (typeof created_after === 'string') params.created_after = new Date(created_after);
      if (typeof created_before === 'string') params.created_before = new Date(created_before);
      if (typeof limit === 'number' && limit > 0) params.limit = limit;
      if (typeof offset === 'number' && offset >= 0) params.offset = offset;

      // Fetch DKIM keys from API
      const rawKeys = await this.dkimAPI.listDKIMKeys(params);
      const keys = Array.isArray(rawKeys) ? rawKeys : [];

      // Apply client-side filtering if needed
      let filteredKeys = keys;

      if (active_only && !params.active) {
        filteredKeys = filteredKeys.filter(key => key.active);
      }

      if (typeof limit === 'number' && limit > 0) {
        const startIndex = typeof offset === 'number' ? offset : 0;
        filteredKeys = filteredKeys.slice(startIndex, startIndex + limit);
      }

      // Format results
      const summary = {
        total_keys: keys.length,
        filtered_keys: filteredKeys.length,
        active_keys: keys.filter(k => k.active).length,
        inactive_keys: keys.filter(k => !k.active).length,
        algorithm_breakdown: {
          rsa: keys.filter(k => k.algorithm === 'rsa').length,
          ed25519: keys.filter(k => k.algorithm === 'ed25519').length,
        },
        filters_applied: params,
        keys: filteredKeys.map(dkimListFields),
      };

      return {
        success: true,
        result: ToolUtils.createJsonResult(summary),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

/**
 * Get detailed information about a specific DKIM key
 */
export class GetDKIMKeyTool extends BaseTool {
  readonly name = 'get_dkim_key';
  readonly description = 'Get detailed information about a specific DKIM key';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string' as const,
        description: 'Domain of the DKIM key',
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])*$',
      },
      selector: {
        type: 'string' as const,
        description: 'Selector of the DKIM key',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 63,
      },
    },
    required: ['domain', 'selector'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private dkimAPI: DKIMAPI) {
    super(logger, {
      category: ToolCategory.DOMAIN,
      version: '1.0.0',
      requiresAuth: true,
      rateLimited: true,
    });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);

      // Validate permissions
      if (!this.validatePermissions(context, ['dkim:read', 'domains:read', 'read'])) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.AUTHORIZATION_ERROR,
            message: 'Permission denied: requires dkim:read permission',
          },
        };
      }

      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: `Input validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          },
        };
      }

      const { domain, selector } = input;

      if (typeof domain !== 'string' || typeof selector !== 'string') {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: 'Domain and selector must be strings',
          },
        };
      }

      // Fetch DKIM key details
      const keyDetails = await this.dkimAPI.getDKIMKey(domain, selector);

      if (!keyDetails) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.RESOURCE_NOT_FOUND,
            message: `DKIM key for domain '${domain}' with selector '${selector}' not found`,
          },
        };
      }

      // Use Mailcow's TXT value as-is; do not wrap it in another v=DKIM1 record
      const dnsRecord = this.dkimAPI.generateDKIMDNSRecord(keyDetails);
      const hasMaterial = Boolean(keyDetails.dkim_txt || keyDetails.public_key);
      const isActive = keyDetails.active !== false && hasMaterial;

      const formattedKey = {
        domain: keyDetails.domain,
        selector: keyDetails.selector,
        algorithm: keyDetails.algorithm,
        ...(typeof keyDetails.key_size === 'number' && keyDetails.key_size > 0
          ? { key_size: keyDetails.key_size }
          : {}),
        active: isActive,
        status: isActive ? 'Active' : 'Inactive',
        public_key: keyDetails.public_key,
        dns_record: dnsRecord,
        dns_host: `${keyDetails.selector}._domainkey.${keyDetails.domain}`,
        ...((keyDetails.created || keyDetails.modified)
          ? {
              timestamps: {
                ...(keyDetails.created ? { created: keyDetails.created } : {}),
                ...(keyDetails.modified ? { last_modified: keyDetails.modified } : {}),
              },
            }
          : {}),
        validation_status: this.dkimAPI.validateDKIMKey(keyDetails) || hasMaterial ? 'Valid' : 'Invalid',
        ...(typeof keyDetails.id === 'number' && keyDetails.id > 0 ? { key_id: keyDetails.id } : {}),
      };

      return {
        success: true,
        result: ToolUtils.createJsonResult(formattedKey),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

/**
 * Create a new DKIM key
 */
export class CreateDKIMKeyTool extends BaseTool {
  readonly name = 'create_dkim_key';
  readonly description =
    'Create a new DKIM key for a domain. Mailcow has no /edit/dkim route — replace a key by delete_dkim_key then create_dkim_key.';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string' as const,
        description: 'Domain for the DKIM key',
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])*$',
      },
      selector: {
        type: 'string' as const,
        description: 'Selector for the DKIM key (unique identifier)',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 63,
      },
      key_size: {
        type: 'number' as const,
        description: 'Key size in bits (1024, 2048, or 4096 for RSA)',
        minimum: 1024,
        maximum: 4096,
      },
      algorithm: {
        type: 'string' as const,
        description: 'Algorithm for the DKIM key',
        enum: ['rsa', 'ed25519'],
      },
    },
    required: ['domain', 'selector'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private dkimAPI: DKIMAPI) {
    super(logger, {
      category: ToolCategory.DOMAIN,
      version: '1.0.0',
      requiresAuth: true,
      rateLimited: true,
    });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);

      // Validate permissions
      if (!this.validatePermissions(context, ['dkim:write', 'domains:write', 'write'])) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.AUTHORIZATION_ERROR,
            message: 'Permission denied: requires dkim:write permission',
          },
        };
      }

      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: `Input validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          },
        };
      }

      const {
        domain,
        selector,
        key_size = 2048,
        algorithm = 'rsa',
      } = input;

      // Validate required string fields
      if (typeof domain !== 'string' || typeof selector !== 'string') {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: 'Domain and selector must be strings',
          },
        };
      }

      // Create DKIM key request
      const dkimRequest: CreateDKIMRequest = {
        domain,
        selector,
        key_size: typeof key_size === 'number' ? key_size : 2048,
        algorithm: typeof algorithm === 'string' ? algorithm as 'rsa' | 'ed25519' : 'rsa',
      };

      // Create DKIM key
      const createdKey = await this.dkimAPI.createDKIMKey(dkimRequest);
      const createdDomain = createdKey.domain || domain;
      const createdSelector = createdKey.selector || selector;

      // Generate DNS record for the new key
      const dnsRecord = this.dkimAPI.generateDKIMDNSRecord(createdKey);

      const result = {
        message: `DKIM key for domain '${createdDomain}' with selector '${createdSelector}' created successfully`,
        dkim_key: {
          domain: createdDomain,
          selector: createdSelector,
          algorithm: createdKey.algorithm,
          ...(typeof createdKey.key_size === 'number' && createdKey.key_size > 0
            ? { key_size: createdKey.key_size }
            : {}),
          active: createdKey.active,
          public_key: createdKey.public_key,
          ...(createdKey.created ? { created: createdKey.created } : {}),
          ...(typeof createdKey.id === 'number' && createdKey.id > 0
            ? { key_id: createdKey.id }
            : {}),
        },
        dns_configuration: {
          dns_record: dnsRecord,
          host: `${createdSelector}._domainkey.${createdDomain}`,
          instructions: 'Add this TXT record to your DNS configuration to enable DKIM signing',
        },
      };

      return {
        success: true,
        result: ToolUtils.createJsonResult(result),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

/**
 * Delete a DKIM key
 */
export class DeleteDKIMKeyTool extends BaseTool {
  readonly name = 'delete_dkim_key';
  readonly description =
    'Delete a DKIM key (WARNING: this stops DKIM signing). Mailcow has no /edit/dkim — create a new key afterwards to rotate.';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string' as const,
        description: 'Domain of the DKIM key to delete',
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])*$',
      },
      selector: {
        type: 'string' as const,
        description: 'Selector of the DKIM key to delete',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 63,
      },
      confirm: {
        type: 'boolean' as const,
        description: 'Confirmation that you want to delete the DKIM key (affects email signing)',
      },
    },
    required: ['domain', 'selector', 'confirm'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private dkimAPI: DKIMAPI) {
    super(logger, {
      category: ToolCategory.DOMAIN,
      version: '1.0.0',
      requiresAuth: true,
      rateLimited: true,
    });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);

      // Validate permissions
      if (!this.validatePermissions(context, ['dkim:delete', 'domains:write', 'write'])) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.AUTHORIZATION_ERROR,
            message: 'Permission denied: requires dkim:delete permission',
          },
        };
      }

      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: `Input validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          },
        };
      }

      const { domain, selector, confirm } = input;

      if (typeof domain !== 'string' || typeof selector !== 'string') {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: 'Domain and selector must be strings',
          },
        };
      }

      if (typeof confirm !== 'boolean') {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: 'Confirm must be a boolean',
          },
        };
      }

      // Check confirmation
      if (!confirm) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: 'DKIM key deletion requires explicit confirmation (confirm: true)',
          },
        };
      }

      // Check if DKIM key exists and get details first
      const keyDetails = await this.dkimAPI.getDKIMKey(domain, selector);
      if (!keyDetails) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.RESOURCE_NOT_FOUND,
            message: `DKIM key for domain '${domain}' with selector '${selector}' not found`,
          },
        };
      }

      // Delete DKIM key
      const success = await this.dkimAPI.deleteDKIMKey(domain, selector);

      if (!success) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INTERNAL_ERROR,
            message: `Failed to delete DKIM key for domain '${domain}' with selector '${selector}'`,
          },
        };
      }

      const result = {
        message: `DKIM key for domain '${domain}' with selector '${selector}' deleted successfully`,
        deleted_key: {
          domain: keyDetails.domain,
          selector: keyDetails.selector,
          algorithm: keyDetails.algorithm,
          ...(typeof keyDetails.key_size === 'number' && keyDetails.key_size > 0
            ? { key_size: keyDetails.key_size }
            : {}),
          was_active: keyDetails.active,
          deleted_at: new Date().toISOString(),
          ...(typeof keyDetails.id === 'number' && keyDetails.id > 0
            ? { key_id: keyDetails.id }
            : {}),
        },
        warning: 'Emails for this domain will no longer be DKIM signed until a new key is created',
        dns_cleanup: `Remove the TXT record for ${keyDetails.selector}._domainkey.${keyDetails.domain} from your DNS configuration`,
      };

      return {
        success: true,
        result: ToolUtils.createJsonResult(result),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

// Export all DKIM tools
export const DKIMTools = {
  ListDKIMKeysTool,
  GetDKIMKeyTool,
  CreateDKIMKeyTool,
  DeleteDKIMKeyTool,
};
