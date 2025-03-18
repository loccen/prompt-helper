import { IWorkflow, IWorkflowStep } from '../../interfaces';
import { WorkflowService } from '../../services';

/**
 * WorkflowService的模拟实现
 */
export class MockWorkflowService implements Partial<WorkflowService> {
  private workflows: IWorkflow[] = [];
  public readonly workflowsFile: string = '/mock/prompts/workflows.json';
  public readonly extensionPath: string = '/mock/extension';
  
  /**
   * 创建 WorkflowService 的模拟实例
   * @param mockWorkflows 预设的工作流列表
   */
  constructor(mockWorkflows: IWorkflow[] = []) {
    this.workflows = mockWorkflows;
  }
  
  /**
   * 获取所有工作流
   */
  public getWorkflows(): IWorkflow[] {
    return this.workflows;
  }
  
  /**
   * 根据ID获取工作流
   * @param workflowId 工作流ID
   */
  public getWorkflowById(workflowId: string): IWorkflow | undefined {
    return this.workflows.find(w => w.id === workflowId);
  }
  
  /**
   * 重新加载工作流列表
   */
  public reload(): void {
    // 模拟重新加载
  }
  
  /**
   * 加载工作流
   */
  public loadWorkflows(): void {
    // 空实现
  }
  
  /**
   * 创建一个mock工作流
   * @param id 工作流ID
   * @param name 工作流名称
   * @param steps 工作流步骤
   */
  public createMockWorkflow(id: string, name: string, steps: IWorkflowStep[]): IWorkflow {
    const workflow: IWorkflow = {
      id,
      name,
      description: `Mock workflow: ${name}`,
      steps
    };
    
    this.workflows.push(workflow);
    return workflow;
  }
  
  /**
   * 添加工作流
   * @param workflow 要添加的工作流
   */
  public addWorkflow(workflow: IWorkflow): void {
    this.workflows.push(workflow);
  }
  
  /**
   * 清空所有工作流
   */
  public clearWorkflows(): void {
    this.workflows = [];
  }
} 