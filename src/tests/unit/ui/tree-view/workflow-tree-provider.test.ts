import * as vscode from 'vscode';
import { WorkflowTreeProvider, WorkflowTreeItem } from '../../../../ui/tree-view/workflow-tree-provider';
import { MockWorkflowService } from '../../../mocks/mock-workflow-service';
import { MockPromptService } from '../../../mocks/mock-prompt-service';
import { IWorkflow, IWorkflowStep, IPromptRole } from '../../../../interfaces';
import { WorkflowService, PromptService } from '../../../../services';

// 模拟utils函数
jest.mock('../../../../utils', () => ({
  extractRoleNameFromId: jest.fn((roleId) => roleId.replace(/^.*?-/, '').replace(/-.*$/, '')),
  insertPromptToChat: jest.fn().mockResolvedValue(undefined)
}));

describe('WorkflowTreeProvider', () => {
  let provider: WorkflowTreeProvider;
  let mockWorkflowService: MockWorkflowService;
  let mockPromptService: MockPromptService;
  let mockWorkflows: IWorkflow[];
  let mockRoles: IPromptRole[];
  
  beforeEach(() => {
    // 设置测试环境
    mockRoles = [
      { 
        id: 'role1', 
        name: '角色1', 
        category: '开发',
        description: '角色1描述',
        filePath: '/fake/path/roles/role1.md',
        sortKey: '01'
      },
      { 
        id: 'role2', 
        name: '角色2', 
        category: '测试',
        description: '角色2描述',
        filePath: '/fake/path/roles/role2.md',
        sortKey: '02'
      }
    ];
    
    const steps1: IWorkflowStep[] = [
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
    
    const steps2: IWorkflowStep[] = [
      {
        id: 'step3',
        name: '步骤3',
        role: 'role2',
        description: '步骤3描述'
      }
    ];
    
    mockWorkflows = [
      {
        id: 'workflow1',
        name: '工作流1',
        description: '工作流1描述',
        steps: steps1
      },
      {
        id: 'workflow2',
        name: '工作流2',
        description: '工作流2描述',
        steps: steps2
      }
    ];
    
    mockPromptService = new MockPromptService(mockRoles);
    mockWorkflowService = new MockWorkflowService(mockWorkflows);
    
    // 将reload方法设置为jest mock函数
    mockWorkflowService.reload = jest.fn();
    
    // 使用类型断言
    provider = new WorkflowTreeProvider(
      mockWorkflowService as unknown as WorkflowService, 
      mockPromptService as unknown as PromptService
    );
  });
  
  test('应正确获取根节点（工作流列表）', async () => {
    const roots = await provider.getChildren();
    
    // 验证工作流数量和名称
    expect(roots.length).toBe(2);
    expect(roots.map(item => item.label).sort()).toEqual(['工作流1', '工作流2']);
    
    // 验证工作流节点属性
    const workflow1 = roots.find(item => item.label === '工作流1');
    expect(workflow1).toBeDefined();
    expect(workflow1?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(workflow1?.workflowId).toBe('workflow1');
  });
  
  test('应正确获取工作流下的步骤', async () => {
    const roots = await provider.getChildren();
    const workflow1 = roots.find(item => item.label === '工作流1');
    
    // 获取工作流1下的步骤
    const steps = await provider.getChildren(workflow1 as WorkflowTreeItem);
    
    // 验证步骤数量
    expect(steps.length).toBe(2);
    
    // 验证步骤节点属性
    const step1 = steps[0];
    expect(step1.label).toContain('步骤1');
    expect(step1.label).toContain('role1'); // 角色名应该包含在标签中
    expect(step1.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(step1.workflowId).toBe('workflow1');
    expect(step1.stepId).toBe('step1');
    expect(step1.command).toBeDefined();
    expect(step1.command?.command).toBe('PromptMaster.insertPrompt');
    expect(step1.command?.arguments).toEqual(['role1']);
  });
  
  test('不存在的工作流应返回空列表', async () => {
    // 创建一个不存在的工作流节点
    const fakeWorkflow = new WorkflowTreeItem(
      '不存在的工作流',
      vscode.TreeItemCollapsibleState.Collapsed,
      'nonexistent'
    );
    
    const steps = await provider.getChildren(fakeWorkflow);
    expect(steps.length).toBe(0);
  });
  
  test('刷新应触发onDidChangeTreeData事件', () => {
    // 监听事件
    const spy = jest.spyOn(provider['_onDidChangeTreeData'], 'fire');
    
    // 执行刷新
    provider.refresh();
    
    // 验证事件被触发
    expect(spy).toHaveBeenCalledWith(null);
    
    // 验证服务reload方法被调用
    expect(mockWorkflowService.reload).toHaveBeenCalled();
  });
  
  test('getTreeItem应返回传入的元素', () => {
    const item = new WorkflowTreeItem('测试项', vscode.TreeItemCollapsibleState.None);
    const result = provider.getTreeItem(item);
    
    expect(result).toBe(item);
  });
  
  test('getWorkflows应调用服务的方法', async () => {
    const result = await provider.getWorkflows();
    
    expect(result).toEqual(mockWorkflows);
  });
  
  test('startWorkflow应正确处理工作流启动', async () => {
    // 模拟工具函数
    const { insertPromptToChat } = require('../../../../utils');
    
    // 向第一个步骤添加contextVars配置
    mockWorkflows[0].steps[0].contextVars = ['userIdea'];
    
    // 调用方法
    await provider.startWorkflow('workflow1', { userIdea: '测试想法' });
    
    // 验证提示词插入
    expect(insertPromptToChat).toHaveBeenCalled();
    
    // 验证参数替换
    const callArg = insertPromptToChat.mock.calls[0][0];
    expect(callArg).toContain('角色1');
    expect(callArg).toContain('角色1描述');
    expect(callArg).toContain('测试想法');
  });
  
  test('startWorkflow应处理不存在的工作流', async () => {
    await expect(provider.startWorkflow('nonexistent', {}))
      .rejects.toThrow('找不到工作流');
  });
}); 