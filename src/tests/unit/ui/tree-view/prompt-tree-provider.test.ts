import * as vscode from 'vscode';
import { PromptTreeProvider, PromptTreeItem } from '../../../../ui/tree-view/prompt-tree-provider';
import { MockPromptService } from '../../../mocks/mock-prompt-service';
import { IPromptRole } from '../../../../interfaces';
import { PromptService } from '../../../../services';

describe('PromptTreeProvider', () => {
  let provider: PromptTreeProvider;
  let mockPromptService: MockPromptService;
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
      },
      { 
        id: 'role3', 
        name: '角色3', 
        category: '开发',
        description: '角色3描述',
        filePath: '/fake/path/roles/role3.md',
        sortKey: '03'
      }
    ];
    
    mockPromptService = new MockPromptService(mockRoles);
    // 将reload方法设置为jest mock函数
    mockPromptService.reload = jest.fn();
    // 使用类型断言
    provider = new PromptTreeProvider(mockPromptService as unknown as PromptService);
  });
  
  test('应正确获取根节点（分类列表）', async () => {
    const roots = await provider.getChildren();
    
    // 验证分类数量和名称
    expect(roots.length).toBe(2);
    expect(roots.map(item => item.label).sort()).toEqual(['开发', '测试']);
    
    // 验证分类节点属性
    const devCategory = roots.find(item => item.label === '开发');
    expect(devCategory).toBeDefined();
    expect(devCategory?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
    expect(devCategory?.id).toBe('category-开发');
  });
  
  test('应正确获取分类下的角色', async () => {
    const roots = await provider.getChildren();
    const devCategory = roots.find(item => item.label === '开发');
    
    // 获取开发分类下的角色
    const devRoles = await provider.getChildren(devCategory as PromptTreeItem);
    
    // 验证角色数量和名称
    expect(devRoles.length).toBe(2);
    expect(devRoles.map(item => item.label).sort()).toEqual(['角色1', '角色3']);
    
    // 验证角色节点属性
    const role1 = devRoles.find(item => item.label === '角色1');
    expect(role1).toBeDefined();
    expect(role1?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(role1?.id).toBe('role1');
    expect(role1?.command).toBeDefined();
    expect(role1?.command?.command).toBe('PromptMaster.insertPrompt');
    expect(role1?.command?.arguments).toEqual(['role1']);
  });
  
  test('空分类下应返回空列表', async () => {
    // 创建一个不存在的分类节点
    const fakeCategory = new PromptTreeItem(
      '不存在的分类',
      vscode.TreeItemCollapsibleState.Expanded,
      'category-不存在的分类'
    );
    
    const roles = await provider.getChildren(fakeCategory);
    expect(roles.length).toBe(0);
  });
  
  test('刷新应触发onDidChangeTreeData事件', () => {
    // 监听事件
    const spy = jest.spyOn(provider['_onDidChangeTreeData'], 'fire');
    
    // 执行刷新
    provider.refresh();
    
    // 验证事件被触发
    expect(spy).toHaveBeenCalledWith(null);
    
    // 验证服务reload方法被调用
    expect(mockPromptService.reload).toHaveBeenCalled();
  });
  
  test('getTreeItem应返回传入的元素', () => {
    const item = new PromptTreeItem('测试项', vscode.TreeItemCollapsibleState.None);
    const result = provider.getTreeItem(item);
    
    expect(result).toBe(item);
  });
  
  test('getPromptContent应调用服务的方法', async () => {
    const spy = jest.spyOn(mockPromptService, 'getPromptContent');
    
    await provider.getPromptContent('role1');
    
    expect(spy).toHaveBeenCalledWith('role1');
  });
}); 