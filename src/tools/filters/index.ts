/**
 * Sieve filter tools (Mailcow /api/v1/add/filter and related endpoints)
 */

import { BaseTool, ToolUtils } from '../base';
import { FilterAPI } from '../../api/filters';
import {
  ToolInput,
  ToolContext,
  ToolHandlerResult,
  CreateSieveFilterRequest,
  UpdateSieveFilterRequest,
  ToolCategory,
} from '../../types';
import { Logger } from '../../utils';
import { EMAIL_PATTERN } from '../patterns';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export class ListSieveFiltersTool extends BaseTool {
  readonly name = 'list_sieve_filters';
  readonly description = 'List Sieve filters, optionally for a single mailbox';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      username: {
        type: 'string' as const,
        description: 'Mailbox address to list filters for',
        pattern: EMAIL_PATTERN,
      },
    },
    additionalProperties: false,
  };

  constructor(logger: Logger, private filterAPI: FilterAPI) {
    super(logger, { category: ToolCategory.SIEVE, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['filters:read', 'mailboxes:read', 'read'], 'Permission denied: requires filters:read permission');
      if (denied) return denied;

      const filters = await this.filterAPI.listFilters({
        username: asString(input.username),
      });

      return {
        success: true,
        result: ToolUtils.createJsonResult({
          total_filters: filters.length,
          filters,
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class CreateSieveFilterTool extends BaseTool {
  readonly name = 'create_sieve_filter';
  readonly description = 'Create a Sieve filter for a mailbox via /api/v1/add/filter';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      username: {
        type: 'string' as const,
        description: 'Mailbox the filter belongs to',
        pattern: EMAIL_PATTERN,
      },
      script_desc: {
        type: 'string' as const,
        description: 'Filter name / description',
      },
      script_data: {
        type: 'string' as const,
        description: 'Sieve script body',
      },
      filter_type: {
        type: 'string' as const,
        enum: ['prefilter', 'postfilter'],
        description: 'prefilter or postfilter (default prefilter)',
      },
      active: {
        type: 'boolean' as const,
        description: 'Activate the filter (default true; deactivates other filters of the same type)',
      },
    },
    required: ['username', 'script_desc', 'script_data'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private filterAPI: FilterAPI) {
    super(logger, { category: ToolCategory.SIEVE, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['filters:write', 'mailboxes:write', 'write'], 'Permission denied: requires filters:write permission');
      if (denied) return denied;

      const validation = this.validateInput(input);
      if (!validation.valid) {
        return this.invalidParams(validation.errors.map((e) => e.message).join(', '));
      }

      const username = asString(input.username);
      const script_desc = asString(input.script_desc);
      const script_data = asString(input.script_data);
      if (!username || !script_desc || !script_data) {
        return this.invalidParams('username, script_desc and script_data must be strings');
      }

      const request: CreateSieveFilterRequest = {
        username,
        script_desc,
        script_data,
        filter_type: input.filter_type === 'postfilter' ? 'postfilter' : 'prefilter',
        active: input.active === false ? false : true,
      };

      const created = await this.filterAPI.createFilter(request);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Sieve filter '${created.script_desc}' created for '${created.username}'`,
          filter: created,
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class UpdateSieveFilterTool extends BaseTool {
  readonly name = 'update_sieve_filter';
  readonly description = 'Update a Sieve filter by numeric id via /api/v1/edit/filter';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string' as const,
        description: 'Numeric filter id',
      },
      script_desc: {
        type: 'string' as const,
        description: 'Updated filter name',
      },
      script_data: {
        type: 'string' as const,
        description: 'Updated Sieve script',
      },
      filter_type: {
        type: 'string' as const,
        enum: ['prefilter', 'postfilter'],
        description: 'Updated filter type',
      },
      active: {
        type: 'boolean' as const,
        description: 'Whether the filter should be active',
      },
    },
    required: ['id'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private filterAPI: FilterAPI) {
    super(logger, { category: ToolCategory.SIEVE, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['filters:write', 'mailboxes:write', 'write'], 'Permission denied: requires filters:write permission');
      if (denied) return denied;

      const id = asString(input.id);
      if (!id) {
        return this.invalidParams('id must be a string');
      }

      const updates: UpdateSieveFilterRequest = {};
      if (typeof input.script_desc === 'string') updates.script_desc = input.script_desc;
      if (typeof input.script_data === 'string') updates.script_data = input.script_data;
      if (input.filter_type === 'prefilter' || input.filter_type === 'postfilter') {
        updates.filter_type = input.filter_type;
      }
      if (typeof input.active === 'boolean') updates.active = input.active;

      if (Object.keys(updates).length === 0) {
        return this.invalidParams('No update parameters provided');
      }

      const updated = await this.filterAPI.updateFilter(id, updates);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Sieve filter '${updated.script_desc}' updated successfully`,
          filter: updated,
          updated_fields: Object.keys(updates),
        }),
      };
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}

export class DeleteSieveFilterTool extends BaseTool {
  readonly name = 'delete_sieve_filter';
  readonly description = 'Delete a Sieve filter by numeric id via /api/v1/delete/filter';
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string' as const,
        description: 'Numeric filter id',
      },
      confirm: {
        type: 'boolean' as const,
        description: 'Must be true to delete the filter',
      },
    },
    required: ['id', 'confirm'],
    additionalProperties: false,
  };

  constructor(logger: Logger, private filterAPI: FilterAPI) {
    super(logger, { category: ToolCategory.SIEVE, version: '1.0.0', requiresAuth: true });
  }

  async execute(input: ToolInput, context: ToolContext): Promise<ToolHandlerResult> {
    try {
      this.logExecution(input, context, true);
      const denied = this.requireAccess(context, ['filters:write', 'filters:delete', 'write'], 'Permission denied: requires filters:write permission');
      if (denied) return denied;

      const id = asString(input.id);
      if (!id) {
        return this.invalidParams('id must be a string');
      }
      if (input.confirm !== true) {
        return this.invalidParams('Sieve filter deletion requires explicit confirmation (confirm: true)');
      }

      const existing = await this.filterAPI.getFilter(id);
      await this.filterAPI.deleteFilter(id);
      return {
        success: true,
        result: ToolUtils.createJsonResult({
          message: `Sieve filter '${existing.script_desc}' deleted successfully`,
          deleted_filter: existing,
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

export const SieveFilterTools = {
  ListSieveFiltersTool,
  CreateSieveFilterTool,
  UpdateSieveFilterTool,
  DeleteSieveFilterTool,
};
