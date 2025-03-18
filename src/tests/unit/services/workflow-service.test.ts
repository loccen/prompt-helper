/**
 * WorkflowService单元测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowService } from '../../../services/workflow-service';
import { IWorkflow } from '../../../interfaces';
import { resetAllMocks } from '../../utils/mock-modules';

describe('WorkflowService', () => {
  // 测试数据
  const mockExtensionPath = '/fake/extension/path';
  const mockWorkflowsFile = path.join(mockExtensionPath, 'prompts', 'workflows.json');
  const mockWorkflows: IWorkflow[] = [
    {
      id: 'workflow1',
      name: '需求分析工作流',
      description: '用于产品需求分析的工作流',
      steps: [
        {
          id: 'step1',
          name: '需求收集',
          role: '1-product-manager',
          description: '收集用户需求和反馈'
        },
        {
          id: 'step2',
          name: '需求分析',
          role: '1-product-manager',
          description: '分析需求的可行性和优先级'
        }
      ]
    },
    {
      id: 'workflow2',
      name: '开发工作流',
      description: '用于软件开发的工作流',
      steps: [
        {
          id: 'step1',
          name: '系统设计',
          role: '2-architect',
          description: '系统架构设计'
        },
        {
          id: 'step2',
          name: '前端开发',
          role: '5-frontend-developer',
          description: '开发用户界面'
        },
        {
          id: 'step3',
          name: '后端开发',
          role: '6-backend-developer',
          description: '开发服务端功能'
        }
      ]
    }
  ];

  let workflowService: WorkflowService;

  beforeEach(() => {
    // 重置所有模拟
    resetAllMocks();

    // 设置文件系统模拟
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      return path === mockWorkflowsFile;
    });

    (fs.readFileSync as jest.Mock).mockImplementation((filePath, encoding) => {
      if (filePath === mockWorkflowsFile) {
        return JSON.stringify({
          workflows: mockWorkflows
        });
      }
      return '';
    });

    // 创建WorkflowService实例
    workflowService = new WorkflowService(mockExtensionPath);
  });

  test('应该正确加载工作流', () => {
    const workflows = workflowService.getWorkflows();
    
    // 验证工作流数量
    expect(workflows.length).toBe(2);
    
    // 验证第一个工作流的信息
    expect(workflows[0].id).toBe('workflow1');
    expect(workflows[0].name).toBe('需求分析工作流');
    expect(workflows[0].steps.length).toBe(2);
    
    // 验证第二个工作流的信息
    expect(workflows[1].id).toBe('workflow2');
    expect(workflows[1].name).toBe('开发工作流');
    expect(workflows[1].steps.length).toBe(3);
  });

  test('应该通过ID获取特定工作流', () => {
    const workflow = workflowService.getWorkflowById('workflow2');
    
    expect(workflow).toBeDefined();
    expect(workflow?.name).toBe('开发工作流');
    expect(workflow?.steps.length).toBe(3);
  });

  test('应该返回undefined当工作流ID不存在', () => {
    const workflow = workflowService.getWorkflowById('non-existent-id');
    
    expect(workflow).toBeUndefined();
  });

  test('应该处理工作流文件不存在的情况', () => {
    // 模拟文件不存在
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => false);
    
    // 重新创建服务实例
    const service = new WorkflowService(mockExtensionPath);
    
    const workflows = service.getWorkflows();
    expect(workflows).toEqual([]);
  });

  test('应该处理JSON解析错误', () => {
    // 模拟无效的JSON内容
    (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
      return '{ invalid json }';
    });
    
    // 重新创建服务实例
    const service = new WorkflowService(mockExtensionPath);
    
    const workflows = service.getWorkflows();
    expect(workflows).toEqual([]);
  });

  test('应该能重新加载工作流数据', () => {
    // 模拟更新后的工作流数据
    const updatedWorkflows = [...mockWorkflows, {
      id: 'workflow3',
      name: '测试工作流',
      description: '用于测试的工作流',
      steps: [
        {
          id: 'step1',
          name: '单元测试',
          role: '7-tester',
          description: '编写和执行单元测试'
        }
      ]
    }];
    
    (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
      return JSON.stringify({
        workflows: updatedWorkflows
      });
    });
    
    // 重新加载
    workflowService.reload();
    
    const workflows = workflowService.getWorkflows();
    expect(workflows.length).toBe(3);
    expect(workflows[2].id).toBe('workflow3');
    expect(workflows[2].name).toBe('测试工作流');
  });
}); 