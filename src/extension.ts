import * as vscode from 'vscode';
import { PromptService, WorkflowService } from './services';
import { PromptTreeProvider, WorkflowTreeProvider } from './ui/tree-view';
import { DevFlowGuideProvider } from './ui/webview/dev-flow-guide-provider';
import { insertPromptToChat, log, handleError } from './utils';

export function activate(context: vscode.ExtensionContext) {
  log('Prompt-Helper 插件已激活', true);

  try {
    // 创建服务层实例
    const promptService = new PromptService(context.extensionPath);
    const workflowService = new WorkflowService(context.extensionPath);
    
    // 创建UI提供者
    const promptTreeProvider = new PromptTreeProvider(promptService);
    const workflowTreeProvider = new WorkflowTreeProvider(
      workflowService,
      promptService
    );
    
    // 创建开发流程引导器提供者
    const devFlowGuideProvider = new DevFlowGuideProvider(
      context.extensionUri,
      promptService,
      workflowService,
      context
    );

    // 注册角色提示词视图
    const promptRolesTreeView = vscode.window.createTreeView('promptRoles', {
      treeDataProvider: promptTreeProvider,
      showCollapseAll: true
    });

    // 注册工作流视图
    const workflowTreeView = vscode.window.createTreeView('promptWorkflows', {
      treeDataProvider: workflowTreeProvider,
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
        const promptContent = await promptService.getPromptContent(roleId);
        if (promptContent) {
          await insertPromptToChat(promptContent);
          vscode.window.showInformationMessage(`已插入角色提示词: ${roleId}`);
        }
      } catch (error) {
        handleError(error, '插入提示词失败');
      }
    });

    // 注册启动项目开发流程命令
    const startWorkflowCommand = vscode.commands.registerCommand('prompt-helper.projectWorkflow', async (workflowId?: string) => {
      try {
        if (!workflowId) {
          // 如果没有指定工作流，则显示选择对话框
          const workflows = workflowService.getWorkflows();
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
        await workflowTreeProvider.startWorkflow(workflowId, { userIdea });
        vscode.window.showInformationMessage(`已启动开发流程: ${workflowId}`);
      } catch (error) {
        handleError(error, '启动工作流失败');
      }
    });
    
    // 注册打开流程引导器命令
    const openDevFlowGuideCommand = vscode.commands.registerCommand('prompt-helper.openDevFlowGuide', () => {
      try {
        vscode.commands.executeCommand('workbench.view.extension.prompt-helper');
        vscode.commands.executeCommand('promptHelper.devFlowGuide.focus');
      } catch (error) {
        handleError(error, '打开流程引导器失败');
      }
    });

    // 将所有资源添加到订阅中以便正确释放
    context.subscriptions.push(
      promptRolesTreeView,
      workflowTreeView,
      insertPromptCommand,
      startWorkflowCommand,
      openDevFlowGuideCommand
    );
  } catch (error) {
    handleError(error, '插件激活失败', true);
  }
}

export function deactivate() {
  log('Prompt-Helper 插件已停用');
} 