/**
 * PromptService单元测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { PromptService } from '../../../services/prompt-service';
import { createMockExtensionContext, resetAllMocks } from '../../utils/mock-modules';

describe('PromptService', () => {
  // 测试数据
  const mockExtensionPath = '/fake/extension/path';
  const mockRolesDir = path.join(mockExtensionPath, 'prompts', 'roles');
  const mockRoleFiles = [
    '0-universal.md',
    '1-product-manager.md',
    '5-frontend-developer.md'
  ];
  const mockRoleContents: { [key: string]: string } = {
    '0-universal.md': '# 通用指南角色提示词\n## 角色描述\n提供通用编码规范和指导',
    '1-product-manager.md': '# 产品经理角色提示词\n## 角色描述\n负责产品规划和需求分析',
    '5-frontend-developer.md': '# 前端开发角色提示词\n## 角色描述\n负责前端界面开发'
  };

  let promptService: PromptService;

  beforeEach(() => {
    // 重置所有模拟
    resetAllMocks();

    // 设置文件系统模拟
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return path === mockRolesDir;
    });

    (fs.readdirSync as jest.Mock).mockImplementation((dir) => {
      if (dir === mockRolesDir) {
        return mockRoleFiles;
      }
      return [];
    });

    (fs.readFileSync as jest.Mock).mockImplementation((filePath, encoding) => {
      const fileName = path.basename(filePath);
      return mockRoleContents[fileName] || '';
    });

    // 创建PromptService实例
    promptService = new PromptService(mockExtensionPath);
  });

  test('应该正确加载角色提示词', () => {
    const roles = promptService.getRoles();
    
    // 验证角色数量
    expect(roles.length).toBe(3);
    
    // 验证角色信息
    expect(roles[0].id).toBe('0-universal');
    expect(roles[0].name).toBe('通用指南');
    expect(roles[0].description).toBe('提供通用编码规范和指导');
    expect(roles[0].category).toBe('通用规范');

    expect(roles[1].id).toBe('1-product-manager');
    expect(roles[1].name).toBe('产品经理');
    expect(roles[1].category).toBe('产品管理');
    
    expect(roles[2].id).toBe('5-frontend-developer');
    expect(roles[2].name).toBe('前端开发');
    expect(roles[2].category).toBe('客户端开发');
  });

  test('应该正确获取所有分类', () => {
    const categories = promptService.getCategories();
    
    expect(categories).toContain('通用规范');
    expect(categories).toContain('产品管理');
    expect(categories).toContain('客户端开发');
    expect(categories.length).toBe(3);
  });

  test('应该通过ID获取特定角色', () => {
    const role = promptService.getRoleById('1-product-manager');
    
    expect(role).toBeDefined();
    expect(role?.name).toBe('产品经理');
    expect(role?.category).toBe('产品管理');
  });

  test('应该通过分类获取角色列表', () => {
    const productRoles = promptService.getRolesByCategory('产品管理');
    
    expect(productRoles.length).toBe(1);
    expect(productRoles[0].id).toBe('1-product-manager');
    
    const frontendRoles = promptService.getRolesByCategory('客户端开发');
    
    expect(frontendRoles.length).toBe(1);
    expect(frontendRoles[0].id).toBe('5-frontend-developer');
  });

  test('应该获取提示词内容', async () => {
    const content = await promptService.getPromptContent('0-universal');
    
    expect(content).toBe(mockRoleContents['0-universal.md']);
  });

  test('应该处理不存在的角色ID', async () => {
    const content = await promptService.getPromptContent('non-existent-id');
    
    expect(content).toBeUndefined();
  });

  test('应该处理读取文件失败的情况', async () => {
    // 模拟读取文件失败
    (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('模拟的文件读取错误');
    });
    
    const content = await promptService.getPromptContent('0-universal');
    
    expect(content).toBeUndefined();
  });

  test('应该能重新加载角色提示词', () => {
    // 模拟更改文件系统状态
    const updatedRoleFiles = [...mockRoleFiles, '8-devops-engineer.md'];
    const updatedRoleContents: { [key: string]: string } = {
      ...mockRoleContents,
      '8-devops-engineer.md': '# DevOps工程师角色提示词\n## 角色描述\n负责自动化部署和运维'
    };
    
    (fs.readdirSync as jest.Mock).mockImplementationOnce((dir) => {
      if (dir === mockRolesDir) {
        return updatedRoleFiles;
      }
      return [];
    });
    
    (fs.readFileSync as jest.Mock).mockImplementation((filePath, encoding) => {
      const fileName = path.basename(filePath);
      return updatedRoleContents[fileName] || '';
    });
    
    // 重新加载
    promptService.reload();
    
    const roles = promptService.getRoles();
    expect(roles.length).toBe(4);
    
    const categories = promptService.getCategories();
    expect(categories).toContain('DevOps');
    expect(categories.length).toBe(4);
  });
}); 