import * as vscode from 'vscode';
import { PromptProvider } from './promptProvider';

export interface IWorkflowStep {
  id: string;
  name: string;
  role: string;
  description: string;
  contextVars?: string[];
  prompt?: string; // 保留兼容旧版本
}

export interface IWorkflow {
  id: string;
  name: string;
  description: string;
  steps: IWorkflowStep[];
}

export declare class WorkflowProvider implements vscode.TreeDataProvider<any> {
  constructor(extensionPath: string, promptProvider: PromptProvider);
  getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem>;
  getChildren(element?: any): vscode.ProviderResult<any[]>;
  getWorkflows(): Promise<IWorkflow[]>;
  startWorkflow(workflowId: string, params: Record<string, string>): Promise<void>;
} 