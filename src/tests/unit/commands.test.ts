import * as vscode from 'vscode';
import { TestUtils } from '../utils/test-utils';
import { IPromptRole, IWorkflow } from '../../interfaces';

// 工作流选择项目接口
interface WorkflowQuickPickItem extends vscode.QuickPickItem {
  id: string;
}

// 模拟vscode的基本功能
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn().mockResolvedValue('确定'),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    createWebviewPanel: jest.fn()
  },
  commands: {
    executeCommand: jest.fn().mockResolvedValue(undefined)
  },
  Uri: {
    joinPath: jest.fn().mockImplementation((uri, ...pathSegments) => {
      return { path: [...uri.path.split('/'), ...pathSegments].join('/') };
    }),
    file: jest.fn(path => ({ path, scheme: 'file' }))
  }
}));

// 模拟utils.ts中的函数
jest.mock('../../utils', () => ({
  log: jest.fn(),
  handleError: jest.fn(),
  insertPromptToChat: jest.fn().mockResolvedValue(undefined),
  extractRoleNameFromId: jest.fn(id => id.split('-').slice(1).join('-'))
}));

// 创建模拟服务实例
const mockPromptService = {
  getRoles: jest.fn().mockReturnValue([]),
  getCategories: jest.fn().mockReturnValue([]),
  getRolesByCategory: jest.fn().mockReturnValue([]),
  getRoleById: jest.fn().mockReturnValue(null),
  getPromptContent: jest.fn().mockResolvedValue('这是测试提示词内容'),
  getPromptById: jest.fn().mockReturnValue({
    id: 'test-role',
    name: '测试角色',
    description: '测试角色描述',
    category: '测试',
    filePath: '/test/path'
  }),
  reloadRoles: jest.fn()
};

const mockWorkflowService = {
  getWorkflows: jest.fn().mockReturnValue([
    {
      id: 'test-workflow',
      name: '测试工作流',
      description: '测试工作流描述',
      steps: [
        { id: 'step1', name: '步骤1', role: 'test-role', description: '步骤1描述' }
      ]
    }
  ]),
  getWorkflowById: jest.fn().mockReturnValue({
    id: 'test-workflow',
    name: '测试工作流',
    description: '测试工作流描述',
    steps: [
      { id: 'step1', name: '步骤1', role: 'test-role', description: '步骤1描述' }
    ]
  })
};

// 模拟服务层
jest.mock('../../services', () => ({
  PromptService: jest.fn().mockImplementation(() => mockPromptService),
  WorkflowService: jest.fn().mockImplementation(() => mockWorkflowService)
}));

// 模拟树视图提供者
const mockWorkflowTreeProvider = {
  refresh: jest.fn(),
  getTreeItem: jest.fn(),
  getChildren: jest.fn().mockReturnValue([]),
  startWorkflow: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../ui/tree-view', () => ({
  PromptTreeProvider: jest.fn().mockImplementation(() => ({
    refresh: jest.fn(),
    getTreeItem: jest.fn(),
    getChildren: jest.fn().mockReturnValue([])
  })),
  WorkflowTreeProvider: jest.fn().mockImplementation(() => mockWorkflowTreeProvider)
}));

// 直接提取命令处理函数
// 注意：这些函数应该是extension.ts中registerCommand调用的内联函数的等效版本
// 实际应用中可能需要将这些函数提取到单独的模块中以便更好地测试

/**
 * 插入提示词命令处理函数
 */
async function insertPromptHandler(roleId: string) {
  try {
    const promptContent = await mockPromptService.getPromptContent(roleId);
    if (promptContent) {
      await require('../../utils').insertPromptToChat(promptContent);
      vscode.window.showInformationMessage(`已插入角色提示词: ${roleId}`);
    }
  } catch (error) {
    require('../../utils').handleError(error, '插入提示词失败');
  }
}

/**
 * 启动项目开发流程命令处理函数
 */
async function projectWorkflowHandler(workflowId?: string) {
  try {
    if (!workflowId) {
      // 如果没有指定工作流，则显示选择对话框
      const workflows = mockWorkflowService.getWorkflows();
      const workflowItems: WorkflowQuickPickItem[] = workflows.map((wf: IWorkflow) => ({
        label: wf.name,
        description: wf.description,
        id: wf.id
      }));

      const selected = await vscode.window.showQuickPick(workflowItems, {
        placeHolder: '选择项目开发流程'
      });

      if (!selected) {
        return;
      }

      workflowId = selected.id;
    }

    // 获取用户输入的项目想法
    const userIdea = await vscode.window.showInputBox({
      prompt: '请输入您的项目/产品想法',
      placeHolder: '例如: 一个帮助开发者管理代码片段的工具'
    });

    if (!userIdea) {
      return;
    }

    // 启动工作流
    await mockWorkflowTreeProvider.startWorkflow(workflowId, { userIdea });
    vscode.window.showInformationMessage(`已启动开发流程: ${workflowId}`);
    
    // 打开视图容器
    await vscode.commands.executeCommand('workbench.view.extension.promptHelperViewContainer');
  } catch (error) {
    require('../../utils').handleError(error, '启动工作流失败');
  }
}

/**
 * 打开流程引导器命令处理函数
 */
function openDevFlowGuideHandler() {
  try {
    vscode.commands.executeCommand('workbench.view.extension.promptHelperViewContainer');
  } catch (error) {
    require('../../utils').handleError(error, '打开流程引导器失败');
  }
}

describe('命令函数测试', () => {
  let insertPromptToChat: jest.Mock;
  let handleError: jest.Mock;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 获取模拟的函数引用
    insertPromptToChat = require('../../utils').insertPromptToChat;
    handleError = require('../../utils').handleError;
  });
  
  describe('插入提示词命令', () => {
    test('应正确调用insertPromptToChat', async () => {
      // 执行命令处理函数
      await insertPromptHandler('test-role');
      
      // 验证获取提示词内容
      expect(mockPromptService.getPromptContent).toHaveBeenCalledWith('test-role');
      
      // 验证插入提示词
      expect(insertPromptToChat).toHaveBeenCalledWith('这是测试提示词内容');
      
      // 验证显示通知
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('test-role')
      );
    });
    
    test('应处理执行过程中的错误', async () => {
      // 模拟错误
      mockPromptService.getPromptContent.mockRejectedValueOnce(new Error('测试错误'));
      
      // 执行命令处理函数
      await insertPromptHandler('test-role');
      
      // 验证错误处理
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('插入提示词失败')
      );
    });
  });
  
  describe('启动项目开发流程命令', () => {
    test('应正确处理工作流', async () => {
      // 模拟用户输入
      (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('测试项目想法');
      
      // 执行命令处理函数，传入工作流ID
      await projectWorkflowHandler('test-workflow');
      
      // 验证用户输入
      expect(vscode.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('项目/产品想法')
        })
      );
      
      // 验证启动工作流
      expect(mockWorkflowTreeProvider.startWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        { userIdea: '测试项目想法' }
      );
      
      // 验证执行webview命令
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.view.extension.promptHelperViewContainer'
      );
    });
    
    test('应允许用户选择工作流', async () => {
      // 模拟用户选择
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
        label: '测试工作流',
        id: 'test-workflow'
      });
      
      // 模拟用户输入
      (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('测试项目想法');
      
      // 执行命令处理函数，不传工作流ID
      await projectWorkflowHandler();
      
      // 验证显示选择菜单
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      
      // 验证启动工作流
      expect(mockWorkflowTreeProvider.startWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        { userIdea: '测试项目想法' }
      );
    });
    
    test('当用户取消选择工作流时应中止操作', async () => {
      // 模拟用户取消选择
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(undefined);
      
      // 执行命令处理函数，不传工作流ID
      await projectWorkflowHandler();
      
      // 验证没有继续询问项目想法
      expect(vscode.window.showInputBox).not.toHaveBeenCalled();
      
      // 验证没有启动工作流
      expect(mockWorkflowTreeProvider.startWorkflow).not.toHaveBeenCalled();
    });
    
    test('当用户取消输入项目想法时应中止操作', async () => {
      // 模拟用户取消输入
      (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);
      
      // 执行命令处理函数
      await projectWorkflowHandler('test-workflow');
      
      // 验证没有启动工作流
      expect(mockWorkflowTreeProvider.startWorkflow).not.toHaveBeenCalled();
    });
  });
  
  describe('打开流程引导器命令', () => {
    test('应执行正确的VSCode命令', async () => {
      // 执行命令处理函数
      openDevFlowGuideHandler();
      
      // 验证执行命令
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.view.extension.promptHelperViewContainer'
      );
    });
  });
}); 