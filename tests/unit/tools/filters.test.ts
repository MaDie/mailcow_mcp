import {
  ListSieveFiltersTool,
  CreateSieveFilterTool,
  UpdateSieveFilterTool,
  DeleteSieveFilterTool,
} from '../../../src/tools/filters';
import { FilterAPI } from '../../../src/api/filters';
import { Logger } from '../../../src/utils';
import { ToolContext, MCPErrorCode } from '../../../src/types';

jest.mock('../../../src/tools/validation', () => ({
  validateToolInput: jest.fn(),
  validateToolSchema: jest.fn(() => ({ valid: true, errors: [], warnings: [] })),
}));

describe('Sieve filter tools', () => {
  let logger: Logger;
  let filterAPI: FilterAPI;
  let context: ToolContext;
  const sample = {
    id: 3,
    username: 'user@example.com',
    script_desc: 'Drop exe',
    script_data: 'discard;',
    filter_type: 'prefilter' as const,
    active: true,
  };

  beforeEach(() => {
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    filterAPI = {
      listFilters: jest.fn(),
      createFilter: jest.fn(),
      updateFilter: jest.fn(),
      deleteFilter: jest.fn(),
      getFilter: jest.fn(),
    } as any;
    context = {
      requestId: 'r1',
      userId: 'u1',
      timestamp: new Date(),
      permissions: ['filters:read', 'filters:write'],
      accessLevel: 'read-write',
    };
  });

  it('lists filters', async () => {
    const tool = new ListSieveFiltersTool(logger, filterAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    (filterAPI.listFilters as jest.Mock).mockResolvedValue([sample]);

    const result = await tool.execute({ username: 'user@example.com' }, context);
    expect(result.success).toBe(true);
    expect(filterAPI.listFilters).toHaveBeenCalledWith({ username: 'user@example.com' });
  });

  it('creates a filter with Mailcow field names', async () => {
    const tool = new CreateSieveFilterTool(logger, filterAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    jest.spyOn(tool as any, 'validateInput').mockReturnValue({ valid: true, errors: [], warnings: [] });
    (filterAPI.createFilter as jest.Mock).mockResolvedValue(sample);

    const result = await tool.execute({
      username: 'user@example.com',
      script_desc: 'Drop exe',
      script_data: 'discard;',
    }, context);

    expect(result.success).toBe(true);
    expect(filterAPI.createFilter).toHaveBeenCalledWith({
      username: 'user@example.com',
      script_desc: 'Drop exe',
      script_data: 'discard;',
      filter_type: 'prefilter',
      active: true,
    });
    const data = JSON.parse((result.result!.content[0] as any).text);
    expect(data.message).toContain('Drop exe');
    expect(data.message).not.toContain('undefined');
  });

  it('updates and deletes by id', async () => {
    const updateTool = new UpdateSieveFilterTool(logger, filterAPI);
    const deleteTool = new DeleteSieveFilterTool(logger, filterAPI);
    jest.spyOn(updateTool as any, 'validatePermissions').mockReturnValue(true);
    jest.spyOn(deleteTool as any, 'validatePermissions').mockReturnValue(true);
    (filterAPI.updateFilter as jest.Mock).mockResolvedValue({ ...sample, active: false });
    (filterAPI.getFilter as jest.Mock).mockResolvedValue(sample);
    (filterAPI.deleteFilter as jest.Mock).mockResolvedValue(undefined);

    const updated = await updateTool.execute({ id: '3', active: false }, context);
    expect(updated.success).toBe(true);

    const deleted = await deleteTool.execute({ id: '3', confirm: true }, context);
    expect(deleted.success).toBe(true);
  });

  it('requires confirmation to delete', async () => {
    const tool = new DeleteSieveFilterTool(logger, filterAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    const result = await tool.execute({ id: '3', confirm: false }, context);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(MCPErrorCode.INVALID_PARAMS);
  });
});
