import * as vscode from 'vscode';
import { DevFlowGuideProvider } from '../../../../ui/webview/dev-flow-guide-provider';
import { MockPromptService } from '../../../mocks/mock-prompt-service';
import { MockWorkflowService } from '../../../mocks/mock-workflow-service';
import { TestUtils } from '../../../utils/test-utils';
import { IPromptRole, IWorkflow, IWorkflowStep } from '../../../../interfaces';
import { PromptService, WorkflowService } from '../../../../services';

// 模拟vscode模块
jest.mock('vscode', () => {
  const originalModule = jest.requireActual('vscode');
  return {
    ...originalModule,
    window: {
      createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
      }),
      showErrorMessage: jest.fn(),
      showInformationMessage: jest.fn(),
      showInputBox: jest.fn(),
      createWebviewPanel: jest.fn()
    },
    commands: {
      executeCommand: jest.fn().mockResolvedValue(undefined)
    },
    env: {
      clipboard: {
        readText: jest.fn().mockResolvedValue('原始剪贴板内容'),
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    },
    Uri: {
      joinPath: jest.fn().mockImplementation((uri, ...pathSegments) => {
        return {
          ...uri,
          path: [...uri.path.split('/'), ...pathSegments].join('/'),
          with: jest.fn().mockReturnThis()
        };
      }),
      file: jest.fn(path => ({ 
        path, 
        scheme: 'file',
        with: jest.fn().mockReturnThis()
      })),
      parse: jest.fn(path => ({ 
        path, 
        scheme: 'file',
        with: jest.fn().mockReturnThis()
      }))
    }
  };
});

// 模拟utils.ts中的函数
jest.mock('../../../../utils', () => ({
  handleError: jest.fn(),
  log: jest.fn(),
  insertPromptToChat: jest.fn().mockResolvedValue(undefined),
  extractRoleNameFromId: jest.fn().mockImplementation(roleId => roleId.split('-').slice(1).join('-'))
}));

// 模拟FlowStepsMappingService
jest.mock('../../../../ui/webview/flow-steps-mapping-service', () => {
  const mockMappingService = {
    getFlowStepsMapping: jest.fn().mockReturnValue([
      { id: 'step1', name: '步骤1', description: '步骤1描述', recommendedRoles: ['role1'] }
    ])
  };
  
  return {
    FlowStepsMappingService: jest.fn().mockImplementation(() => mockMappingService)
  };
});

// 模拟DevFlowHtmlGenerator
jest.mock('../../../../ui/webview/dev-flow-html-generator', () => {
  const mockGenerator = {
    setWebview: jest.fn(),
    getWelcomePageHtml: jest.fn().mockReturnValue('<html>欢迎页面</html>'),
    getStepViewHtml: jest.fn().mockResolvedValue('<html>步骤视图</html>'),
    getRoleCardsHtml: jest.fn().mockReturnValue('<div>角色卡片</div>'),
    getFlowCompletionHtml: jest.fn().mockReturnValue('<html>流程完成页面</html>')
  };
  
  return {
    DevFlowHtmlGenerator: jest.fn().mockImplementation(() => mockGenerator),
    mockGenerator // 导出模拟对象，便于测试访问
  };
});

// 创建状态管理器模拟对象
const mockFlowState = {
  flowId: '',
  currentStepIndex: 0,
  completedSteps: [] as string[],
  projectContext: {}
};

const mockStateManager = {
  state: mockFlowState,
  setFlowId: jest.fn((flowId: string) => { mockFlowState.flowId = flowId; }),
  setCurrentStepIndex: jest.fn((index: number) => { mockFlowState.currentStepIndex = index; }),
  addCompletedStep: jest.fn((stepId: string) => { 
    if (!mockFlowState.completedSteps.includes(stepId)) {
      mockFlowState.completedSteps.push(stepId);
    }
  }),
  updateProjectContext: jest.fn((context: Record<string, any>) => {
    mockFlowState.projectContext = { ...mockFlowState.projectContext, ...context };
  }),
  resetState: jest.fn(() => {
    mockFlowState.flowId = '';
    mockFlowState.currentStepIndex = 0;
    mockFlowState.completedSteps = [];
    mockFlowState.projectContext = {};
  }),
  isStepCompleted: jest.fn((stepId: string) => mockFlowState.completedSteps.includes(stepId)),
  initNewFlow: jest.fn((flowId: string) => {
    mockFlowState.flowId = flowId;
    mockFlowState.currentStepIndex = 0;
    mockFlowState.completedSteps = [];
    mockFlowState.projectContext = {};
  }),
  moveToNextStep: jest.fn(() => { mockFlowState.currentStepIndex += 1; }),
  moveToPrevStep: jest.fn(() => { 
    if (mockFlowState.currentStepIndex > 0) {
      mockFlowState.currentStepIndex -= 1;
    }
  })
};

// 模拟FlowStateManager
jest.mock('../../../../ui/webview/flow-state-manager', () => {  
  return {
    FlowStateManager: jest.fn().mockImplementation(() => mockStateManager)
  };
});

describe('DevFlowGuideProvider', () => {
  let provider: DevFlowGuideProvider;
  let mockPromptService: MockPromptService;
  let mockWorkflowService: MockWorkflowService;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: any;
  let mockRoles: IPromptRole[];
  let mockWorkflows: IWorkflow[];
  
  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 设置测试环境
    mockContext = TestUtils.createMockExtensionContext() as unknown as vscode.ExtensionContext;
    
    // 创建模拟的WebView
    mockWebviewView = TestUtils.createMockWebviewView();
    
    // 创建测试数据
    mockRoles = [
      { 
        id: 'role1', 
        name: '角色1', 
        category: '开发',
        description: '角色1描述',
        filePath: '/fake/path/roles/role1.md',
        sortKey: '01'
      }
    ];
    
    const steps: IWorkflowStep[] = [
      {
        id: 'step1',
        name: '步骤1',
        role: 'role1',
        description: '步骤1描述'
      },
      {
        id: 'step2',
        name: '步骤2',
        role: 'role1',
        description: '步骤2描述'
      }
    ];
    
    mockWorkflows = [
      {
        id: 'workflow1',
        name: '工作流1',
        description: '工作流1描述',
        steps: steps
      }
    ];
    
    mockPromptService = new MockPromptService(mockRoles);
    mockWorkflowService = new MockWorkflowService(mockWorkflows);
    
    // 添加mock方法
    (mockPromptService as any).getPromptById = jest.fn();
    (mockWorkflowService as any).getWorkflowById = jest.fn(id => mockWorkflows.find(w => w.id === id));
    
    // 创建要测试的组件，使用类型断言
    provider = new DevFlowGuideProvider(
      mockContext.extensionUri,
      mockPromptService as unknown as PromptService,
      mockWorkflowService as unknown as WorkflowService,
      mockContext
    );
  });
  
  test('应正确初始化WebView', () => {
    provider.resolveWebviewView(mockWebviewView);
    
    // 验证WebView配置
    expect(mockWebviewView.webview.options.enableScripts).toBe(true);
    expect(mockWebviewView.webview.html).toBeTruthy();
  });
  
  test('初始化时应显示欢迎页面', () => {
    provider.resolveWebviewView(mockWebviewView);
    
    // 获取HTML生成器模拟对象
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    
    // 验证getWelcomePageHtml被调用
    expect(mockGenerator.getWelcomePageHtml).toHaveBeenCalledWith(
      expect.any(Array),
      undefined
    );
    
    // 验证HTML内容被设置到WebView
    expect(mockWebviewView.webview.html).toBe('<html>欢迎页面</html>');
  });
  
  test('应正确处理startFlow消息', async () => {
    // 设置模拟输入
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('测试项目想法');
    
    provider.resolveWebviewView(mockWebviewView);
    
    // 获取消息处理函数
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收startFlow消息
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 验证输入框显示
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('项目'),
        ignoreFocusOut: true
      })
    );
    
    // 验证初始化新流程
    expect(mockStateManager.initNewFlow).toHaveBeenCalledWith('workflow1');
    expect(mockStateManager.updateProjectContext).toHaveBeenCalledWith({ userIdea: '测试项目想法' });
    
    // 验证更新视图
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
  });
  
  test('处理startFlow消息时用户取消应显示欢迎页面', async () => {
    // 设置模拟输入为取消
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);
    
    provider.resolveWebviewView(mockWebviewView);
    
    // 获取消息处理函数
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收startFlow消息
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 验证显示欢迎页面
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getWelcomePageHtml).toHaveBeenCalled();
  });
  
  test('应正确处理nextStep消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置初始状态
    mockFlowState.flowId = 'workflow1';
    
    // 模拟接收nextStep消息
    await messageHandler({
      command: 'nextStep'
    });
    
    // 验证移动到下一步
    expect(mockStateManager.moveToNextStep).toHaveBeenCalled();
    
    // 验证视图更新
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
  });
  
  test('应正确处理prevStep消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置初始状态
    mockFlowState.flowId = 'workflow1';
    mockFlowState.currentStepIndex = 1;
    
    // 模拟接收prevStep消息
    await messageHandler({
      command: 'prevStep'
    });
    
    // 验证移动到上一步
    expect(mockStateManager.moveToPrevStep).toHaveBeenCalled();
    
    // 验证视图更新
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
  });
  
  test('应正确处理confirmResetFlow消息', async () => {
    // 设置模拟确认
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValueOnce('确定');
    
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收confirmResetFlow消息
    await messageHandler({
      command: 'confirmResetFlow'
    });
    
    // 验证确认对话框显示
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('重置'),
      { modal: true },
      '确定',
      '取消'
    );
    
    // 验证状态重置
    expect(mockStateManager.resetState).toHaveBeenCalled();
    
    // 验证显示欢迎页面
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getWelcomePageHtml).toHaveBeenCalled();
  });
  
  test('应正确处理newFlow消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收newFlow消息
    await messageHandler({
      command: 'newFlow'
    });
    
    // 验证状态重置
    expect(mockStateManager.resetState).toHaveBeenCalled();
    
    // 验证显示欢迎页面
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getWelcomePageHtml).toHaveBeenCalled();
    
    // 验证显示通知
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('准备开始新流程')
    );
  });
  
  test('应正确处理completeStep消息', async () => {
    // 设置模拟输入
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('docs/test');
    
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置初始状态
    mockFlowState.flowId = 'workflow1';
    mockFlowState.currentStepIndex = 0;
    
    // 模拟接收completeStep消息
    await messageHandler({
      command: 'completeStep'
    });
    
    // 验证输入框显示
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('输出目录'),
        ignoreFocusOut: true
      })
    );
    
    // 验证步骤完成
    const mockWorkflow = (mockWorkflowService as any).getWorkflowById('workflow1');
    expect(mockStateManager.addCompletedStep).toHaveBeenCalledWith(mockWorkflow.steps[0].id);
    expect(mockStateManager.updateProjectContext).toHaveBeenCalledWith(
      expect.objectContaining({ 'step1_outputPath': 'docs/test' })
    );
    
    // 验证视图更新
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
    
    // 验证显示通知
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('docs/test')
    );
  });
  
  test('处理completeStep消息时用户取消应恢复视图', async () => {
    // 设置模拟输入为取消
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);
    
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置初始状态
    mockFlowState.flowId = 'workflow1';
    
    // 模拟接收completeStep消息
    await messageHandler({
      command: 'completeStep'
    });
    
    // 验证没有添加已完成步骤
    expect(mockStateManager.addCompletedStep).not.toHaveBeenCalled();
    
    // 验证视图更新
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
  });
  
  test('应正确处理applyRolePrompt消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置模拟角色提示词
    const mockPrompt: IPromptRole = {
      id: 'role1',
      name: '角色1',
      description: '这是角色1的提示词内容',
      category: '开发',
      filePath: '/fake/path/roles/role1.md',
      sortKey: '01'
    };
    
    (mockPromptService as any).getPromptById.mockReturnValueOnce(mockPrompt);
    
    // 模拟接收applyRolePrompt消息
    await messageHandler({
      command: 'applyRolePrompt',
      roleId: 'role1'
    });
    
    // 验证获取角色提示词
    expect((mockPromptService as any).getPromptById).toHaveBeenCalledWith('role1');
    
    // 验证插入提示词到聊天
    const insertPromptToChat = require('../../../../utils').insertPromptToChat;
    expect(insertPromptToChat).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '这是角色1的提示词内容'
      })
    );
    
    // 验证显示通知
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('角色1')
    );
  });
  
  test('应正确处理异常情况', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 设置模拟异常
    jest.spyOn(mockWorkflowService as any, 'getWorkflowById').mockImplementationOnce(() => {
      throw new Error('测试错误');
    });
    
    // 模拟接收startFlow消息
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 验证错误处理
    const handleError = require('../../../../utils').handleError;
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(String)
    );
    
    // 验证显示欢迎页面
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getWelcomePageHtml).toHaveBeenCalled();
  });
  
  test('应正确处理加载状态', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收显示加载状态消息
    await messageHandler({
      command: 'showLoading',
      message: '测试加载'
    });
    
    // 验证postMessage被调用
    expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
      command: 'showLoading',
      message: '测试加载'
    });
  });
  
  test('应正确处理取消加载消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    // 设置初始状态
    mockFlowState.flowId = 'workflow1';
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收cancelLoading消息
    await messageHandler({
      command: 'cancelLoading'
    });
    
    // 验证视图更新
    const { mockGenerator } = require('../../../../ui/webview/dev-flow-html-generator');
    expect(mockGenerator.getStepViewHtml).toHaveBeenCalled();
  });
}); 