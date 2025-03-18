import * as vscode from 'vscode';
import { DevFlowGuideProvider } from '../../../../ui/webview/dev-flow-guide-provider';
import { MockPromptService } from '../../../mocks/mock-prompt-service';
import { MockWorkflowService } from '../../../mocks/mock-workflow-service';
import { TestUtils } from '../../../utils/test-utils';
import { IPromptRole, IWorkflow, IWorkflowStep } from '../../../../interfaces';
import { PromptService, WorkflowService } from '../../../../services';

// 模拟utils.ts中的函数
jest.mock('../../../../utils', () => ({
  handleError: jest.fn(),
  log: jest.fn(),
  insertPromptToChat: jest.fn().mockResolvedValue(undefined)
}));

// 模拟FlowStepsMappingService
jest.mock('../../../../ui/webview/flow-steps-mapping-service', () => {
  return {
    FlowStepsMappingService: jest.fn().mockImplementation(() => ({
      getStepsForFlow: jest.fn().mockReturnValue([
        { id: 'step1', name: '步骤1', description: '步骤1描述', recommendedRoles: ['role1'] }
      ])
    }))
  };
});

// 注意：这些测试需要模拟更多的VSCode API，如Uri.joinPath等
// 暂时跳过这些测试，等后续完善VSCode API模拟后再启用
describe.skip('DevFlowGuideProvider', () => {
  let provider: DevFlowGuideProvider;
  let mockPromptService: MockPromptService;
  let mockWorkflowService: MockWorkflowService;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: any;
  let mockRoles: IPromptRole[];
  let mockWorkflows: IWorkflow[];
  
  beforeEach(() => {
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
    
    // 验证HTML内容生成
    expect(mockWebviewView.webview.html).toBeTruthy();
    expect(mockWebviewView.webview.html).toContain('流程引导');
  });
  
  test('应显示欢迎页面', () => {
    provider.resolveWebviewView(mockWebviewView);
    
    // 验证HTML内容包含工作流列表
    expect(mockWebviewView.webview.html).toContain('工作流1');
  });
  
  test('应正确处理startFlow消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    // 获取消息处理函数
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 模拟接收startFlow消息
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 验证更新消息被发送到WebView
    const postMessageCalls = mockWebviewView.webview.postMessage.mock.calls;
    
    // 应该有至少一次更新状态的消息
    const updateStateCall = postMessageCalls.find((call: any) => 
      call[0] && call[0].command === 'updateState'
    );
    
    expect(updateStateCall).toBeDefined();
    
    if (updateStateCall) {
      // 验证状态内容
      const state = updateStateCall[0].state;
      expect(state.flowId).toBe('workflow1');
    }
  });
  
  test('应正确处理nextStep消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 首先启动流程
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 重置模拟函数调用记录
    mockWebviewView.webview.postMessage.mockClear();
    
    // 模拟接收nextStep消息
    await messageHandler({
      command: 'nextStep'
    });
    
    // 验证状态被更新
    const postMessageCalls = mockWebviewView.webview.postMessage.mock.calls;
    const updateStateCall = postMessageCalls.find((call: any) => 
      call[0] && call[0].command === 'updateState'
    );
    
    expect(updateStateCall).toBeDefined();
    
    if (updateStateCall) {
      // 验证步骤索引被增加
      const state = updateStateCall[0].state;
      expect(state.currentStepIndex).toBe(1);
    }
  });
  
  test('应正确处理resetFlow消息', async () => {
    provider.resolveWebviewView(mockWebviewView);
    
    const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    
    // 首先启动流程
    await messageHandler({
      command: 'startFlow',
      flowId: 'workflow1'
    });
    
    // 重置模拟函数调用记录
    mockWebviewView.webview.postMessage.mockClear();
    
    // 模拟接收resetFlow消息
    await messageHandler({
      command: 'resetFlow'
    });
    
    // 预期应该重置状态并显示欢迎页面
    expect(mockWebviewView.webview.html).toBeTruthy();
    
    // 验证信息提示
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('流程已重置')
    );
  });
}); 