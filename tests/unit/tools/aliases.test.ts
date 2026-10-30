import {
  ListAliasesTool,
  GetAliasTool,
  CreateAliasTool,
  UpdateAliasTool,
  DeleteAliasTool,
} from '../../../src/tools/aliases';
import { AliasAPI } from '../../../src/api/aliases';
import { Logger } from '../../../src/utils';
import { ToolContext, MCPErrorCode } from '../../../src/types';

jest.mock('../../../src/tools/validation', () => ({
  validateToolInput: jest.fn(),
  validateToolSchema: jest.fn(() => ({ valid: true, errors: [], warnings: [] })),
}));

describe('Alias tools', () => {
  let logger: Logger;
  let aliasAPI: AliasAPI;
  let context: ToolContext;

  const sample = {
    id: 6,
    address: 'alias@example.com',
    goto: 'user@example.com',
    domain: 'example.com',
    active: true,
    created: '2024-01-01',
    modified: null,
  };

  beforeEach(() => {
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    aliasAPI = {
      listAliases: jest.fn(),
      getAliasDetails: jest.fn(),
      createAlias: jest.fn(),
      updateAlias: jest.fn(),
      deleteAlias: jest.fn(),
    } as any;
    context = {
      requestId: 'r1',
      userId: 'u1',
      timestamp: new Date(),
      permissions: ['aliases:read', 'aliases:write', 'aliases:delete'],
      accessLevel: 'read-write',
    };
  });

  it('lists aliases', async () => {
    const tool = new ListAliasesTool(logger, aliasAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    jest.spyOn(tool as any, 'validateInput').mockReturnValue({ valid: true, errors: [], warnings: [] });
    (aliasAPI.listAliases as jest.Mock).mockResolvedValue([sample]);

    const result = await tool.execute({ domain: 'example.com' }, context);
    expect(result.success).toBe(true);
    const data = JSON.parse((result.result!.content[0] as any).text);
    expect(data.total_aliases).toBe(1);
    expect(data.aliases[0].address).toBe('alias@example.com');
  });

  it('creates an alias and reports the real address', async () => {
    const tool = new CreateAliasTool(logger, aliasAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    jest.spyOn(tool as any, 'validateInput').mockReturnValue({ valid: true, errors: [], warnings: [] });
    (aliasAPI.createAlias as jest.Mock).mockResolvedValue(sample);

    const result = await tool.execute({
      address: 'alias@example.com',
      goto: 'user@example.com',
    }, context);

    expect(result.success).toBe(true);
    expect(aliasAPI.createAlias).toHaveBeenCalledWith({
      address: 'alias@example.com',
      goto: 'user@example.com',
      active: true,
      sogo_visible: true,
      public_comment: undefined,
      private_comment: undefined,
    });
    const data = JSON.parse((result.result!.content[0] as any).text);
    expect(data.message).toContain('alias@example.com');
    expect(data.message).not.toContain('undefined');
  });

  it('rejects address === goto before calling the API', async () => {
    const tool = new CreateAliasTool(logger, aliasAPI);
    jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
    jest.spyOn(tool as any, 'validateInput').mockReturnValue({ valid: true, errors: [], warnings: [] });

    const result = await tool.execute({
      address: 'same@example.com',
      goto: 'same@example.com',
    }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(MCPErrorCode.INVALID_PARAMS);
    expect(aliasAPI.createAlias).not.toHaveBeenCalled();
  });

  it('gets, updates and deletes by id', async () => {
    const getTool = new GetAliasTool(logger, aliasAPI);
    const updateTool = new UpdateAliasTool(logger, aliasAPI);
    const deleteTool = new DeleteAliasTool(logger, aliasAPI);
    for (const tool of [getTool, updateTool, deleteTool]) {
      jest.spyOn(tool as any, 'validatePermissions').mockReturnValue(true);
      jest.spyOn(tool as any, 'validateInput').mockReturnValue({ valid: true, errors: [], warnings: [] });
    }
    (aliasAPI.getAliasDetails as jest.Mock).mockResolvedValue(sample);
    (aliasAPI.updateAlias as jest.Mock).mockResolvedValue({ ...sample, goto: 'new@example.com' });
    (aliasAPI.deleteAlias as jest.Mock).mockResolvedValue(undefined);

    const got = await getTool.execute({ id: '6' }, context);
    expect(got.success).toBe(true);

    const updated = await updateTool.execute({ id: '6', goto: 'new@example.com' }, context);
    expect(updated.success).toBe(true);
    expect(aliasAPI.updateAlias).toHaveBeenCalledWith('6', { goto: 'new@example.com' });

    const deleted = await deleteTool.execute({ id: '6', confirm: true }, context);
    expect(deleted.success).toBe(true);
  });
});
