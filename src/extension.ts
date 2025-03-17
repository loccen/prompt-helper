import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PromptProvider } from './promptProvider';
import { WorkflowProvider } from './workflowProvider';
import { DevFlowGuideProvider } from './devFlowGuideProvider';
import { insertPromptToChat } from './utils';

export function activate(context: vscode.ExtensionContext) {
  console.log('Prompt-Helper  插件已激活');

  // 创建提示词和工作流提供者
  const promptProvider = new PromptProvider(context.extensionPath);
  const workflowProvider = new WorkflowProvider(context.extensionPath, promptProvider);
  
  // 创建开发流程引导器提供者
  const devFlowGuideProvider = new DevFlowGuideProvider(
    context.extensionUri,
    promptProvider,
    workflowProvider
  );

  // 注册角色提示词视图
  const promptRolesTreeView = vscode.window.createTreeView('promptRoles', {
    treeDataProvider: promptProvider,
    showCollapseAll: true
  });

  // 注册工作流视图
  const workflowTreeView = vscode.window.createTreeView('promptWorkflows', {
    treeDataProvider: workflowProvider,
    showCollapseAll: true
  });
  
  // 注册开发流程引导器视图
  vscode.window.registerWebviewViewProvider(
    DevFlowGuideProvider.viewType,
    devFlowGuideProvider
  );

  // 注册插入提示词命令
  const insertPromptCommand = vscode.commands.registerCommand('prompt-helper.insertPrompt', async (roleId: string) => {
    try {
      const promptContent = await promptProvider.getPromptContent(roleId);
      if (promptContent) {
        await insertPromptToChat(promptContent);
        vscode.window.showInformationMessage(`已插入角色提示词: ${roleId}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`插入提示词失败: ${error}`);
    }
  });

  // 注册启动项目开发流程命令
  const startWorkflowCommand = vscode.commands.registerCommand('prompt-helper.projectWorkflow', async (workflowId?: string) => {
    try {
      if (!workflowId) {
        // 如果没有指定工作流，则显示选择对话框
        const workflows = await workflowProvider.getWorkflows();
        const workflowItems = workflows.map(wf => ({
          label: wf.name,
          description: wf.description,
          id: wf.id
        }));

        const selected = await vscode.window.showQuickPick(workflowItems, {
          placeHolder: '选择项目开发流程'
        });

        if (!selected) {
          return;
        }

        workflowId = selected.id;
      }

      // 获取用户输入的项目想法
      const userIdea = await vscode.window.showInputBox({
        prompt: '请输入您的项目/产品想法',
        placeHolder: '例如: 一个帮助开发者管理代码片段的工具'
      });

      if (!userIdea) {
        return;
      }

      // 启动工作流
      await workflowProvider.startWorkflow(workflowId, { userIdea });
      vscode.window.showInformationMessage(`已启动开发流程: ${workflowId}`);
    } catch (error) {
      vscode.window.showErrorMessage(`启动工作流失败: ${error}`);
    }
  });
  
  // 注册打开流程引导器命令
  const openDevFlowGuideCommand = vscode.commands.registerCommand('prompt-helper.openDevFlowGuide', () => {
    try {
      vscode.commands.executeCommand('workbench.view.extension.prompt-helper');
      vscode.commands.executeCommand('promptHelper.devFlowGuide.focus');
    } catch (error) {
      vscode.window.showErrorMessage(`打开流程引导器失败: ${error}`);
    }
  });

  context.subscriptions.push(
    promptRolesTreeView,
    workflowTreeView,
    insertPromptCommand,
    startWorkflowCommand,
    openDevFlowGuideCommand
  );
}

export function deactivate() {
  console.log('Prompt-Helper  插件已停用');
} 