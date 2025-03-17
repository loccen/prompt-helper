import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PromptProvider, PromptTreeItem } from './promptProvider';
import { insertPromptToChat } from './utils';

export interface IWorkflowStep {
  id: string;
  name: string;
  role: string;
  description: string;
  prompt?: string;
  contextVars?: string[];
}

export interface IWorkflow {
  id: string;
  name: string;
  description: string;
  steps: IWorkflowStep[];
}

export class WorkflowTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly workflowId?: string,
    public readonly stepId?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = label;
    if (workflowId) {
      this.id = stepId ? `${workflowId}-${stepId}` : workflowId;
    }
  }
}

export class WorkflowProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeItem | undefined | null> = new vscode.EventEmitter<WorkflowTreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeItem | undefined | null> = this._onDidChangeTreeData.event;

  private workflows: IWorkflow[] = [];
  private workflowsFile: string;

  constructor(
    private extensionPath: string,
    private promptProvider: PromptProvider
  ) {
    this.workflowsFile = path.join(this.extensionPath, 'prompts', 'workflows.json');
    this.loadWorkflows();
  }

  refresh(): void {
    this.loadWorkflows();
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
    if (!element) {
      // 根节点，显示所有工作流
      return this.workflows.map(workflow => new WorkflowTreeItem(
        workflow.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        workflow.id,
      ));
    } else if (element.workflowId && !element.stepId) {
      // 工作流节点，显示该工作流的所有步骤
      const workflow = this.workflows.find(wf => wf.id === element.workflowId);
      if (workflow) {
        return workflow.steps.map(step => {
          // 从role ID中提取角色名称，去掉前缀和后缀
          const roleName = this.extractRoleNameFromId(step.role);
          return new WorkflowTreeItem(
            `${step.name} (${roleName})`,
            vscode.TreeItemCollapsibleState.None,
            workflow.id,
            step.id,
            {
              command: 'prompt-helper.insertPrompt',
              title: '插入步骤提示词',
              arguments: [step.role]
            }
          );
        });
      }
    }
    return [];
  }

  /**
   * 从文件ID中提取角色名称
   * 例如：从"9-2-VSCode插件开发工程师角色提示词"提取"VSCode插件开发工程师"
   */
  private extractRoleNameFromId(roleId: string): string {
    // 移除数字前缀 (例如 "9-2-")
    let roleName = roleId.replace(/^\d+-\d+-/, '').replace(/^\d+-/, '');
    
    // 移除"角色提示词"后缀
    roleName = roleName.replace(/角色提示词$/, '');
    
    return roleName;
  }

  private loadWorkflows() {
    try {
      if (fs.existsSync(this.workflowsFile)) {
        const content = fs.readFileSync(this.workflowsFile, 'utf-8');
        const data = JSON.parse(content);
        this.workflows = data.workflows || [];
      }
    } catch (error) {
      console.error('加载工作流失败:', error);
      this.workflows = [];
    }
  }

  async getWorkflows(): Promise<IWorkflow[]> {
    return this.workflows;
  }

  async startWorkflow(workflowId: string, params: Record<string, string>): Promise<void> {
    const workflow = this.workflows.find(wf => wf.id === workflowId);
    if (!workflow) {
      throw new Error(`找不到工作流: ${workflowId}`);
    }

    // 获取第一个步骤
    const firstStep = workflow.steps[0];
    if (!firstStep) {
      throw new Error(`工作流没有定义步骤: ${workflowId}`);
    }

    // 格式化提示词，替换变量
    let promptContent = '';
    
    if (firstStep.prompt) {
      // 如果有定义prompt字段，使用它
      promptContent = firstStep.prompt;
      
      // 替换变量
      for (const [key, value] of Object.entries(params)) {
        promptContent = promptContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    } else {
      // 否则获取角色的提示词
      const rolePrompt = await this.promptProvider.getPromptContent(firstStep.role);
      if (!rolePrompt) {
        throw new Error(`找不到角色提示词: ${firstStep.role}`);
      }
      
      promptContent = rolePrompt;
      
      // 如果有contextVars，添加上下文信息
      if (firstStep.contextVars && firstStep.contextVars.includes('userIdea') && params.userIdea) {
        promptContent += `\n\n我的项目想法是：${params.userIdea}\n`;
      }
    }

    // 插入到聊天窗口
    await insertPromptToChat(promptContent);
  }
} 