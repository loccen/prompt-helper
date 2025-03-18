import * as vscode from 'vscode';
import { DevFlowHtmlGenerator } from '../../../../ui/webview/dev-flow-html-generator';
import { TestUtils } from '../../../utils/test-utils';
import { IWorkflow, IWorkflowStep } from '../../../../interfaces';

// 模拟vscode模块
jest.mock('vscode', () => {
  const originalModule = jest.requireActual('vscode');
  return {
    ...originalModule,
    Uri: {
      joinPath: jest.fn().mockImplementation((uri, ...pathSegments) => {
        const joinedPath = [...uri.path.split('/'), ...pathSegments].join('/');
        return {
          fsPath: joinedPath,
          scheme: 'file',
          path: joinedPath,
          with: jest.fn().mockReturnThis(),
          toString: jest.fn().mockReturnValue(`file://${joinedPath}`)
        };
      }),
      file: jest.fn(path => ({
        path,
        scheme: 'file',
        with: jest.fn().mockReturnThis()
      }))
    }
  };
});

// 模拟utils.ts中的函数
jest.mock('../../../../utils', () => ({
  extractRoleNameFromId: jest.fn(id => id.split('-').slice(1).join('-'))
}));

describe('DevFlowHtmlGenerator', () => {
  let generator: DevFlowHtmlGenerator;
  let mockExtensionUri: vscode.Uri;
  let mockWebview: vscode.Webview;
  let mockWorkflows: IWorkflow[];
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建模拟的Uri
    mockExtensionUri = {
      fsPath: '/test/extension/path',
      scheme: 'file',
      path: '/test/extension/path',
      with: jest.fn().mockReturnThis(),
      toString: jest.fn().mockReturnValue('file:///test/extension/path')
    } as unknown as vscode.Uri;
    
    // 创建模拟的Webview
    mockWebview = {
      asWebviewUri: jest.fn(uri => uri),
      cspSource: 'https://test-csp-source',
      html: '',
      options: {},
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn()
    } as unknown as vscode.Webview;
    
    // 创建测试数据
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
        role: 'role2',
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
    
    // 创建要测试的组件
    generator = new DevFlowHtmlGenerator(mockExtensionUri);
    
    // 设置webview
    generator.setWebview(mockWebview);
  });
  
  test('setWebview方法应正确设置webview', () => {
    // 创建新实例并设置webview，确保测试是独立的
    const newGenerator = new DevFlowHtmlGenerator(mockExtensionUri);
    newGenerator.setWebview(mockWebview);
    
    // 使用私有属性测试（不推荐，但为了测试需要）
    // @ts-ignore: 访问私有属性
    expect(newGenerator['_webview']).toBe(mockWebview);
  });
  
  test('getWelcomePageHtml方法应生成包含工作流卡片的HTML', () => {
    const html = generator.getWelcomePageHtml(mockWorkflows);
    
    // 验证HTML包含工作流信息
    expect(html).toContain('工作流1');
    expect(html).toContain('工作流1描述');
    expect(html).toContain('开发流程引导器');
    
    // 验证包含脚本
    expect(html).toContain('<script>');
    expect(html).toContain('acquireVsCodeApi()');
    
    // 验证包含工作流卡片
    expect(html).toContain('workflow-card');
    expect(html).toContain('data-workflow-id="workflow1"');
    
    // 验证包含按钮
    expect(html).toContain('start-workflow-btn');
    
    // 验证步骤数量显示
    expect(html).toContain('2 个步骤');
  });
  
  test('getWelcomePageHtml方法应包含错误消息（如果提供）', () => {
    const errorMessage = '测试错误消息';
    const html = generator.getWelcomePageHtml(mockWorkflows, errorMessage);
    
    // 验证HTML包含错误信息
    expect(html).toContain('error-message');
    expect(html).toContain(errorMessage);
  });
  
  test('getWelcomePageHtml方法在webview未设置时应抛出错误', () => {
    // 创建新实例但不设置webview
    const newGenerator = new DevFlowHtmlGenerator(mockExtensionUri);
    
    // 移除现有的webview
    // @ts-ignore: 访问私有属性
    newGenerator['_webview'] = undefined;
    
    expect(() => newGenerator.getWelcomePageHtml(mockWorkflows)).toThrow('Webview实例未设置');
  });
  
  test('getRoleCardsHtml方法应生成角色卡片HTML', () => {
    const roleIds = ['role1', 'role2-测试'];
    const roleNames = ['角色1', ''];
    
    const html = generator.getRoleCardsHtml(roleIds, roleNames);
    
    // 验证包含角色卡片
    expect(html).toContain('role-card');
    expect(html).toContain('data-role-id="role1"');
    expect(html).toContain('data-role-id="role2-测试"');
    
    // 验证角色名称正确显示
    expect(html).toContain('角色1');
    
    // 验证第二个角色使用了提取的名称（通过模拟函数）
    const extractRoleNameFromId = require('../../../../utils').extractRoleNameFromId;
    expect(extractRoleNameFromId).toHaveBeenCalledWith('role2-测试');
    
    // 验证包含角色图标
    expect(html).toContain('role-icon');
  });
  
  test('getRoleCardsHtml方法在没有角色时应显示提示', () => {
    const html = generator.getRoleCardsHtml([], []);
    
    // 验证提示文本
    expect(html).toContain('no-roles');
    expect(html).toContain('此步骤没有推荐角色');
  });
  
  test('getStepViewHtml方法应生成步骤视图HTML', async () => {
    const workflow = mockWorkflows[0];
    const currentStep = workflow.steps[0];
    const currentStepIndex = 0;
    const totalSteps = workflow.steps.length;
    const recommendedRoles = ['role1'];
    const isCompleted = false;
    const roleCardsHtml = '<div class="role-card">角色1</div>';
    
    const html = await generator.getStepViewHtml(
      workflow,
      currentStep,
      currentStepIndex,
      totalSteps,
      recommendedRoles,
      isCompleted,
      roleCardsHtml
    );
    
    // 验证包含工作流名称
    expect(html).toContain(workflow.name);
    
    // 验证包含步骤信息
    expect(html).toContain(currentStep.name);
    expect(html).toContain(currentStep.description);
    
    // 验证包含步骤导航
    expect(html).toContain('步骤 1/2');
    
    // 验证包含角色卡片
    expect(html).toContain(roleCardsHtml);
    
    // 验证包含脚本
    expect(html).toContain('<script>');
    expect(html).toContain('acquireVsCodeApi()');
    
    // 验证包含按钮
    expect(html).toContain('prev-btn');
    expect(html).toContain('next-btn');
    expect(html).toContain('complete-btn');
    
    // 验证上一步按钮在第一步时禁用
    expect(html).toContain('prev-btn" disabled');
  });
  
  test('getStepViewHtml方法在webview未设置时应抛出错误', async () => {
    // 创建新实例但不设置webview
    const newGenerator = new DevFlowHtmlGenerator(mockExtensionUri);
    
    // 移除现有的webview
    // @ts-ignore: 访问私有属性
    newGenerator['_webview'] = undefined;
    
    const workflow = mockWorkflows[0];
    const currentStep = workflow.steps[0];
    
    await expect(
      newGenerator.getStepViewHtml(
        workflow,
        currentStep,
        0,
        2,
        [],
        false,
        ''
      )
    ).rejects.toThrow('Webview实例未设置');
  });
  
  test('getFlowCompletionHtml方法应生成完成页面HTML', () => {
    const workflow = mockWorkflows[0];
    const html = generator.getFlowCompletionHtml(workflow);
    
    // 验证包含完成信息
    expect(html).toContain('项目开发流程已完成');
    expect(html).toContain(workflow.name);
    
    // 验证包含步骤回顾
    expect(html).toContain('流程回顾');
    expect(html).toContain('步骤1');
    expect(html).toContain('步骤2');
    
    // 验证包含按钮
    expect(html).toContain('new-flow-btn');
    expect(html).toContain('reset-btn');
    
    // 验证包含脚本
    expect(html).toContain('<script>');
    expect(html).toContain('acquireVsCodeApi()');
  });
  
  test('getFlowCompletionHtml方法在webview未设置时应抛出错误', () => {
    // 创建新实例但不设置webview
    const newGenerator = new DevFlowHtmlGenerator(mockExtensionUri);
    
    // 移除现有的webview
    // @ts-ignore: 访问私有属性
    newGenerator['_webview'] = undefined;
    
    const workflow = mockWorkflows[0];
    
    expect(() => newGenerator.getFlowCompletionHtml(workflow)).toThrow('Webview实例未设置');
  });
}); 