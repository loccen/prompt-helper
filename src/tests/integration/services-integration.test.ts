/**
 * 服务层集成测试
 * 测试多个服务之间的交互
 */

import * as fs from 'fs';
import * as path from 'path';
import { PromptService } from '../../services/prompt-service';
import { WorkflowService } from '../../services/workflow-service';
import { resetAllMocks } from '../utils/mock-modules';

describe('服务层集成测试', () => {
  // 测试数据
  const mockExtensionPath = '/fake/extension/path';
  const mockRolesDir = path.join(mockExtensionPath, 'prompts', 'roles');
  const mockWorkflowsFile = path.join(mockExtensionPath, 'prompts', 'workflows.json');
  
  // 角色测试数据
  const mockRoleFiles = [
    '1-product-manager.md',
    '2-architect.md',
    '5-frontend-developer.md',
    '6-backend-developer.md'
  ];
  
  const mockRoleContents: { [key: string]: string } = {
    '1-product-manager.md': '# 产品经理角色提示词\n## 角色描述\n负责产品规划和需求分析',
    '2-architect.md': '# 架构师角色提示词\n## 角色描述\n负责系统架构设计',
    '5-frontend-developer.md': '# 前端开发角色提示词\n## 角色描述\n负责前端界面开发',
    '6-backend-developer.md': '# 后端开发角色提示词\n## 角色描述\n负责后端服务开发'
  };
  
  // 工作流测试数据
  const mockWorkflows = [
    {
      id: 'workflow1',
      name: '完整开发工作流',
      description: '从需求到实现的完整工作流',
      steps: [
        {
          id: 'step1',
          name: '需求分析',
          role: '1-product-manager',
          description: '分析需求并确定优先级'
        },
        {
          id: 'step2',
          name: '架构设计',
          role: '2-architect',
          description: '设计系统架构'
        },
        {
          id: 'step3',
          name: '前端开发',
          role: '5-frontend-developer',
          description: '实现用户界面'
        },
        {
          id: 'step4',
          name: '后端开发',
          role: '6-backend-developer',
          description: '实现后端服务'
        }
      ]
    }
  ];
  
  let promptService: PromptService;
  let workflowService: WorkflowService;
  
  beforeEach(() => {
    // 重置所有模拟
    resetAllMocks();
    
    // 设置文件系统模拟
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return path === mockRolesDir || path === mockWorkflowsFile;
    });
    
    (fs.readdirSync as jest.Mock).mockImplementation((dir) => {
      if (dir === mockRolesDir) {
        return mockRoleFiles;
      }
      return [];
    });
    
    (fs.readFileSync as jest.Mock).mockImplementation((filePath, encoding) => {
      const fileName = path.basename(filePath);
      
      if (filePath === mockWorkflowsFile) {
        return JSON.stringify({
          workflows: mockWorkflows
        });
      }
      
      return mockRoleContents[fileName] || '';
    });
    
    // 创建服务实例
    promptService = new PromptService(mockExtensionPath);
    workflowService = new WorkflowService(mockExtensionPath);
  });
  
  test('工作流应该引用有效的角色', () => {
    // 获取所有工作流
    const workflows = workflowService.getWorkflows();
    
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        // 检查每个步骤引用的角色是否存在
        const role = promptService.getRoleById(step.role);
        expect(role).toBeDefined();
        expect(role?.id).toBe(step.role);
      }
    }
  });
  
  test('通过工作流获取角色提示词内容', async () => {
    // 获取工作流
    const workflow = workflowService.getWorkflowById('workflow1');
    expect(workflow).toBeDefined();
    
    if (workflow) {
      // 获取第一个步骤
      const step = workflow.steps[0];
      
      // 获取该步骤角色的提示词内容
      const content = await promptService.getPromptContent(step.role);
      expect(content).toBeDefined();
      expect(content).toBe(mockRoleContents[`${step.role}.md`]);
      
      // 验证角色信息
      const role = promptService.getRoleById(step.role);
      expect(role).toBeDefined();
      expect(role?.name).toBe('产品经理');
    }
  });
  
  test('所有工作流步骤都应引用有效的角色', () => {
    // 获取所有角色ID
    const roles = promptService.getRoles();
    const roleIds = roles.map(role => role.id);
    
    // 获取所有工作流
    const workflows = workflowService.getWorkflows();
    
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        // 检查角色ID是否在已知的角色列表中
        expect(roleIds).toContain(step.role);
      }
    }
  });
});