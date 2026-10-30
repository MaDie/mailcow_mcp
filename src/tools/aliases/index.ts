/**
 * Alias management tools
 */

import { BaseTool, ToolUtils } from '../base';
import { AliasAPI } from '../../api/aliases';
import {
  ToolInput,
  ToolContext,
  ToolHandlerResult,
  CreateAliasRequest,
  UpdateAliasRequest,
  ToolCategory,
} from '../../types';
import { Logger } from '../../utils';
import { ALIAS_ADDRESS_PATTERN } from '../patterns';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export class ListAliasesTool extends BaseTool {
  readonly name = 'list_aliases';
  readonly description = 'List mailbox aliases with optional domain, address and destination filters';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string' as const,
        description: 'Filter by domain',
      },
      address: {
        type: 'string' as const,
        description: 'Filter by alias address (partial match)',
      },
      goto: {
        type: 'string' as const,
        description: 'Filter by destination address',
      },
      active_only: {
        type: 'boolean' as const,
        description: 'Only return active aliases',
      },
      limit: {
        type: 'number' as const,
        description: 'Maximum number of aliases to return',
        minimum: 1,
        maximum: 1000,
      },
    },
    additionalProperties: false,
  };

  constructor(logger: Logger, private aliasAPI: AliasAPI) {
    super(logger, { category: ToolCategory.ALIAS, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['aliases:read', 'read'], 'Permission denied: requires aliases:read permission');
      if (denied) return denied;

      const validation = this.validateInput(input);
      if (!validation.valid) {
        return this.invalidParams(validation.errors.map((e) => e.message).join(', '));
      }

      const aliases = await this.aliasAPI.listAliases({
        domain: asString(input.domain),
        address: asString(input.address),
        goto: asString(input.goto),
        active: input.active_only === true ? true : undefined,
      });

      const limit = typeof input.limit === 'number' && input.limit > 0 ? input.limit : aliases.length;
      const sliced = aliases.slice(0, limit);

      return {
        success: true,
        result: ToolUtils.createJsonResult({
          total_aliases: aliases.length,
          returned: sliced.length,
          aliases: sliced.map((alias) => ({
            id: alias.id,
            address: alias.address,
            goto: alias.goto,
            domain: alias.domain,
            active: alias.active,
            sogo_visible: alias.sogo_visible,
          })),
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class GetAliasTool extends BaseTool {
  readonly name = 'get_alias';
  readonly description = 'Get a mailbox alias by numeric id or address';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string' as const,
        description: 'Numeric alias id',
      },
      address: {
        type: 'string' as const,
        description: 'Alias address',
        pattern: ALIAS_ADDRESS_PATTERN,
      },
    },
    additionalProperties: false,
  };

  constructor(logger: Logger, private aliasAPI: AliasAPI) {
    super(logger, { category: ToolCategory.ALIAS, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['aliases:read', 'read'], 'Permission denied: requires aliases:read permission');
      if (denied) return denied;

      const id = asString(input.id);
      const address = asString(input.address);
      if (!id && !address) {
        return this.invalidParams('Provide id or address');
      }

      const alias = await this.aliasAPI.getAliasDetails(id || address || '');
      return {
        success: true,
        result: ToolUtils.createJsonResult(alias),
      };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return this.notFound(message);
      }
      return this.handleError(error as Error, context);
    }
  }
}

export class CreateAliasTool extends BaseTool {
  readonly name = 'create_alias';
  readonly description = 'Create a mailbox alias. Defaults to active and visible in SOGo. Catch-all addresses use @domain.tld.';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      address: {
        type: 'string' as const,
        description: 'Alias address, or @domain.tld for catch-all',
        pattern: ALIAS_ADDRESS_PATTERN,
      },
      goto: {
        type: 'string' as const,
        description: 'Destination address(es), comma-separated',
      },
      active: {
        type: 'boolean' as const,
        description: 'Whether the alias should be active (default true)',
      },
      sogo_visible: {
        type: 'boolean' as const,
        description: 'Show as selectable sender in SOGo (default true)',
      },
      public_comment: {
        type: 'string' as const,
        description: 'Public comment',
      },
      private_comment: {
        type: 'string' as const,
        description: 'Private comment',
      },
    },
    required: ['address', 'goto'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private aliasAPI: AliasAPI) {
    super(logger, { category: ToolCategory.ALIAS, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['aliases:write', 'write'], 'Permission denied: requires aliases:write permission');
      if (denied) return denied;

      const validation = this.validateInput(input);
      if (!validation.valid) {
        return this.invalidParams(validation.errors.map((e) => e.message).join(', '));
      }

      const address = asString(input.address);
      const goto = asString(input.goto);
      if (!address || !goto) {
        return this.invalidParams('address and goto must be strings');
      }
      if (address === goto) {
        return this.invalidParams('Mailcow silently skips aliases whose address equals goto');
      }

      const request: CreateAliasRequest = {
        address,
        goto,
        active: input.active === false ? false : true,
        sogo_visible: input.sogo_visible === false ? false : true,
        public_comment: asString(input.public_comment),
        private_comment: asString(input.private_comment),
      };

      const created = await this.aliasAPI.createAlias(request);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Alias '${created.address}' created successfully`,
          alias: created,
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class UpdateAliasTool extends BaseTool {
  readonly name = 'update_alias';
  readonly description = 'Update a mailbox alias by numeric id';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string' as const,
        description: 'Numeric alias id',
      },
      address: {
        type: 'string' as const,
        description: 'Updated alias address',
        pattern: ALIAS_ADDRESS_PATTERN,
      },
      goto: {
        type: 'string' as const,
        description: 'Updated destination address(es)',
      },
      active: {
        type: 'boolean' as const,
        description: 'Whether the alias should be active',
      },
      sogo_visible: {
        type: 'boolean' as const,
        description: 'SOGo sender visibility',
      },
      public_comment: {
        type: 'string' as const,
        description: 'Public comment',
      },
      private_comment: {
        type: 'string' as const,
        description: 'Private comment',
      },
    },
    required: ['id'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private aliasAPI: AliasAPI) {
    super(logger, { category: ToolCategory.ALIAS, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['aliases:write', 'write'], 'Permission denied: requires aliases:write permission');
      if (denied) return denied;

      const id = asString(input.id);
      if (!id) {
        return this.invalidParams('id must be a string');
      }

      const updates: UpdateAliasRequest = {};
      if (typeof input.address === 'string') updates.address = input.address;
      if (typeof input.goto === 'string') updates.goto = input.goto;
      if (typeof input.active === 'boolean') updates.active = input.active;
      if (typeof input.sogo_visible === 'boolean') updates.sogo_visible = input.sogo_visible;
      if (typeof input.public_comment === 'string') updates.public_comment = input.public_comment;
      if (typeof input.private_comment === 'string') updates.private_comment = input.private_comment;

      if (Object.keys(updates).length === 0) {
        return this.invalidParams('No update parameters provided');
      }

      const updated = await this.aliasAPI.updateAlias(id, updates);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Alias '${updated.address}' updated successfully`,
          alias: updated,
          updated_fields: Object.keys(updates),
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class DeleteAliasTool extends BaseTool {
  readonly name = 'delete_alias';
  readonly description = 'Delete a mailbox alias by numeric id';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string' as const,
        description: 'Numeric alias id',
      },
      confirm: {
        type: 'boolean' as const,
        description: 'Must be true to delete the alias',
      },
    },
    required: ['id', 'confirm'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private aliasAPI: AliasAPI) {
    super(logger, { category: ToolCategory.ALIAS, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['aliases:write', 'aliases:delete', 'write'], 'Permission denied: requires aliases:write permission');
      if (denied) return denied;

      const id = asString(input.id);
      if (!id) {
        return this.invalidParams('id must be a string');
      }
      if (input.confirm !== true) {
        return this.invalidParams('Alias deletion requires explicit confirmation (confirm: true)');
      }

      const existing = await this.aliasAPI.getAliasDetails(id);
      await this.aliasAPI.deleteAlias(id);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Alias '${existing.address}' deleted successfully`,
          deleted_alias: existing,
        }),
      };
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return this.notFound((error as Error).message);
      }
      return this.handleError(error as Error, context);
    }
  }
}

export const AliasTools = {
  ListAliasesTool,
  GetAliasTool,
  CreateAliasTool,
  UpdateAliasTool,
  DeleteAliasTool,
};
