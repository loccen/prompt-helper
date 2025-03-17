import * as vscode from 'vscode';
import { BaseTreeItem } from '../../interfaces';
import { WorkflowService, PromptService } from '../../services';
import { extractRoleNameFromId, insertPromptToChat } from '../../utils';

/**
 * 工作流树项
 */
export class WorkflowTreeItem extends BaseTreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly workflowId?: string,
    public readonly stepId?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState, stepId ? `${workflowId}-${stepId}` : workflowId, command);
  }
}

/**
 * 工作流树视图提供者
 * 负责提供工作流的树视图数据
 */
export class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeItem | undefined | null> = new vscode.EventEmitter<WorkflowTreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeItem | undefined | null> = this._onDidChangeTreeData.event;

  constructor(
    private workflowService: WorkflowService,
    private promptService: PromptService
  ) {}

  /**
   * 刷新树视图
   */
  refresh(): void {
    this.workflowService.reload();
    this._onDidChangeTreeData.fire(null);
  }

  /**
   * 获取树项
   */
  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子项
   */
  async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
    if (!element) {
      // 根节点，显示所有工作流
      return this.workflowService.getWorkflows().map(workflow => new WorkflowTreeItem(
        workflow.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        workflow.id,
      ));
    } else if (element.workflowId && !element.stepId) {
      // 工作流节点，显示该工作流的所有步骤
      const workflow = this.workflowService.getWorkflowById(element.workflowId);
      if (workflow) {
        return workflow.steps.map(step => {
          // 从role ID中提取角色名称
          const roleName = extractRoleNameFromId(step.role);
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
   * 获取所有工作流
   */
  async getWorkflows() {
    return this.workflowService.getWorkflows();
  }

  /**
   * 启动工作流
   * @param workflowId 工作流ID
   * @param params 参数
   */
  async startWorkflow(workflowId: string, params: Record<string, string>): Promise<void> {
    const workflow = this.workflowService.getWorkflowById(workflowId);
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
      const rolePrompt = await this.promptService.getPromptContent(firstStep.role);
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