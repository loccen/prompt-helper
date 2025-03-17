import * as vscode from 'vscode';

/**
 * 角色提示词接口
 */
export interface IPromptRole {
  id: string;
  name: string;
  description: string;
  filePath: string;
  category: string;
  sortKey: string;
}

/**
 * 角色分类映射接口
 */
export interface ICategoryMapping {
  [prefix: string]: string;
}

/**
 * 工作流步骤接口
 */
export interface IWorkflowStep {
  id: string;
  name: string;
  role: string;
  description: string;
  prompt?: string;
  contextVars?: string[];
}

/**
 * 工作流接口
 */
export interface IWorkflow {
  id: string;
  name: string;
  description: string;
  steps: IWorkflowStep[];
}

/**
 * 流程步骤接口
 */
export interface IFlowStep {
  id: string;
  name: string;
  description: string;
  recommendedRoles: string[];
  outputArtifacts: string[];
}

/**
 * 流程状态接口
 */
export interface IFlowState {
  flowId: string;
  currentStepIndex: number;
  projectContext: Record<string, any>;
  completedSteps: string[];
}

/**
 * 树节点接口的基类
 */
export class BaseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly id?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = label;
    if (id) {
      this.id = id;
    }
  }
} 