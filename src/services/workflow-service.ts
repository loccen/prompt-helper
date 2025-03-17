import * as fs from 'fs';
import * as path from 'path';
import { IWorkflow } from '../interfaces';
import { log, handleError } from '../utils';

/**
 * 工作流服务类
 * 负责加载和管理工作流数据
 */
export class WorkflowService {
  private workflows: IWorkflow[] = [];
  private workflowsFile: string;

  constructor(private extensionPath: string) {
    this.workflowsFile = path.join(this.extensionPath, 'prompts', 'workflows.json');
    this.loadWorkflows();
  }

  /**
   * 获取所有工作流
   */
  getWorkflows(): IWorkflow[] {
    return this.workflows;
  }

  /**
   * 通过ID获取特定工作流
   * @param workflowId 工作流ID
   */
  getWorkflowById(workflowId: string): IWorkflow | undefined {
    return this.workflows.find(wf => wf.id === workflowId);
  }

  /**
   * 重新加载工作流数据
   */
  reload(): void {
    this.loadWorkflows();
  }

  /**
   * 加载所有工作流
   */
  private loadWorkflows() {
    try {
      if (fs.existsSync(this.workflowsFile)) {
        const content = fs.readFileSync(this.workflowsFile, 'utf-8');
        const data = JSON.parse(content);
        this.workflows = data.workflows || [];
      }
    } catch (error) {
      handleError(error, '加载工作流失败');
      this.workflows = [];
    }
  }
} 