import * as vscode from 'vscode';
import { IFlowStep, IWorkflow } from '../../interfaces';
import { PromptService, WorkflowService } from '../../services';
import { insertPromptToChat, handleError, log } from '../../utils';
import { DevFlowHtmlGenerator } from './dev-flow-html-generator';
import { FlowStateManager } from './flow-state-manager';
import { FlowStepsMappingService } from './flow-steps-mapping-service';

/**
 * 项目开发流程引导器
 * 提供可视化界面引导用户完成项目开发流程
 */
export class DevFlowGuideProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'promptHelper.devFlowGuide';
  private _view?: vscode.WebviewView;
  
  // 组件依赖
  private _stateManager: FlowStateManager;
  private _htmlGenerator: DevFlowHtmlGenerator;
  private _mappingService: FlowStepsMappingService;
  
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _promptService: PromptService,
    private readonly _workflowService: WorkflowService,
    private readonly _context: vscode.ExtensionContext
  ) {
    // 初始化组件依赖
    this._stateManager = new FlowStateManager(_context);
    this._htmlGenerator = new DevFlowHtmlGenerator(_extensionUri);
    this._mappingService = new FlowStepsMappingService(_extensionUri.fsPath);
  }
  
  /**
   * 创建并初始化WebView视图
   */
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    
    // 设置WebView内容和功能
    webviewView.webview.options = { 
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'resources'),
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };
    
    // 设置HTML生成器的webview
    this._htmlGenerator.setWebview(webviewView.webview);
    
    // 根据当前状态决定显示欢迎页还是步骤页
    const flowState = this._stateManager.state;
    if (flowState.flowId) {
      // 已有活动流程，尝试恢复显示
      const workflows = this._workflowService.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowState.flowId);
      if (workflow) {
        this._updateFlowView(workflow);
      } else {
        // 找不到对应工作流，显示欢迎页
        this._showWelcomePage();
      }
    } else {
      // 初始首页内容
      this._showWelcomePage();
    }
    
    // 处理来自WebView的消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.command) {
          case 'startFlow':
            await this._startNewFlow(message.flowId);
            break;
          case 'nextStep':
            await this._moveToNextStep();
            break;
          case 'prevStep':
            await this._moveToPrevStep();
            break;
          case 'resetFlow':
            try {
              // 显示加载指示器，然后重置流程，最后显示欢迎页面
              console.log('接收到resetFlow命令');
              vscode.window.showInformationMessage('正在重置流程...');
              
              // 首先尝试重置状态
              this._stateManager.resetState();
              console.log('状态已重置');
              
              // 显示加载中状态
              this._showLoading('正在重置流程...');
              
              // 确保UI更新
              setTimeout(() => {
                console.log('显示欢迎页面');
                const workflows = this._workflowService.getWorkflows();
                if (this._view) {
                  this._view.webview.html = this._htmlGenerator.getWelcomePageHtml(workflows);
                  vscode.window.showInformationMessage('流程已重置，返回首页');
                }
              }, 500);
            } catch (error) {
              handleError(error, '重置流程失败');
              this._showWelcomePage();
            }
            break;
          case 'newFlow':
            // 显示加载指示器，然后重置流程，最后显示欢迎页面
            this._showLoading('准备新流程...');
            // 重置状态
            this._stateManager.resetState();
            // 显示欢迎页面
            setTimeout(() => {
              this._showWelcomePage();
              vscode.window.showInformationMessage('准备开始新流程');
            }, 200);
            break;
          case 'cancelLoading':
            // 处理取消加载的请求，恢复到之前的视图状态
            await this._handleCancelLoading();
            break;
          case 'completeStep':
            try {
              // 获取当前流程状态，用于恢复视图
              const flowState = this._stateManager.state;
              const workflow = this._workflowService.getWorkflowById(flowState.flowId);
              if (!workflow) {
                throw new Error('找不到当前工作流');
              }
              
              // 显示加载状态
              this._showLoading('正在处理步骤...');
              
              // 显示要求输入目录路径的输入框
              const outputPath = await vscode.window.showInputBox({
                prompt: '请输入此步骤的输出目录路径（相对于项目根目录）',
                placeHolder: '例如: docs/产品经理',
                ignoreFocusOut: true, // 防止用户切换窗口时输入框关闭
              });
              
              if (outputPath !== undefined) {
                await this._completeCurrentStep({ outputPath });
                
                // 显示通知
                vscode.window.showInformationMessage(`步骤已完成，输出将保存在 ${outputPath} 目录`);
              } else {
                // 用户取消了输入，恢复视图
                await this._updateFlowView(workflow);
              }
            } catch (error) {
              handleError(error, '完成步骤失败');
              // 恢复视图，尝试回到当前工作流
              try {
                const flowState = this._stateManager.state;
                const workflow = this._workflowService.getWorkflowById(flowState.flowId);
                if (workflow) {
                  await this._updateFlowView(workflow);
                } else {
                  this._showWelcomePage();
                }
              } catch (e) {
                this._showWelcomePage();
              }
            }
            break;
          case 'applyRolePrompt':
            await this._applyRolePrompt(message.roleId);
            break;
          case 'confirmResetFlow':
            // 显示确认对话框
            vscode.window.showInformationMessage(
              '确定要重置当前流程吗？这将清除所有进度。', 
              { modal: true },
              '确定', '取消'
            ).then(selection => {
              if (selection === '确定') {
                try {
                  // 显示加载指示器，然后重置流程，最后显示欢迎页面
                  console.log('用户确认重置流程');
                  vscode.window.showInformationMessage('正在重置流程...');
                  
                  // 首先尝试重置状态
                  this._stateManager.resetState();
                  console.log('状态已重置');
                  
                  // 显示加载中状态
                  this._showLoading('正在重置流程...');
                  
                  // 确保UI更新
                  setTimeout(() => {
                    console.log('显示欢迎页面');
                    const workflows = this._workflowService.getWorkflows();
                    if (this._view) {
                      this._view.webview.html = this._htmlGenerator.getWelcomePageHtml(workflows);
                      vscode.window.showInformationMessage('流程已重置，返回首页');
                    }
                  }, 500);
                } catch (error) {
                  handleError(error, '重置流程失败');
                  this._showWelcomePage();
                }
              }
            });
            break;
        }
      } catch (error) {
        handleError(error, '处理WebView消息失败');
        this._showWelcomePage(String(error));
      }
    });
  }
  
  /**
   * 显示欢迎页
   */
  private _showWelcomePage(errorMessage?: string): void {
    if (!this._view) return;
    
    const workflows = this._workflowService.getWorkflows();
    this._view.webview.html = this._htmlGenerator.getWelcomePageHtml(workflows, errorMessage);
  }
  
  /**
   * 向WebView发送消息
   * @param command 命令
   * @param data 数据
   */
  private _postMessage(command: string, data: any = {}): void {
    if (this._view) {
      this._view.webview.postMessage({ command, ...data });
    }
  }

  /**
   * 显示加载指示器
   * @param message 加载提示信息
   */
  private _showLoading(message: string = '正在加载...'): void {
    if (!this._view) {
      return;
    }
    
    const styleMainUri = this._htmlGenerator.getResourceUri('media/styles.css');
    
    this._view.webview.html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._view.webview.cspSource} 'unsafe-inline'; img-src ${this._view.webview.cspSource} https:; script-src 'unsafe-inline';">
        <title>开发流程引导器</title>
        <link rel="stylesheet" href="${styleMainUri}">
      </head>
      <body>
        <div class="container">
          <div class="loading-container">
            <div class="spinner"></div>
            <p class="loading-text">${message}</p>
            <button class="cancel-btn">取消</button>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 取消按钮点击处理
            document.querySelector('.cancel-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'cancelLoading'
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }
  
  /**
   * 启动新流程
   * @param flowId 流程ID
   */
  private async _startNewFlow(flowId: string): Promise<void> {
    try {
      // 先获取工作流信息验证有效性
      const workflow = this._workflowService.getWorkflowById(flowId);
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      // 显示加载指示器
      this._showLoading('正在准备项目流程...');
      
      // 获取项目想法
      const userIdea = await vscode.window.showInputBox({
        prompt: '请输入您的项目/产品想法',
        placeHolder: '例如: 一个帮助开发者管理代码片段的工具',
        ignoreFocusOut: true
      });
      
      if (!userIdea) {
        console.log('用户未输入项目想法，返回欢迎页面');
        this._showWelcomePage();
        return;
      }
      
      // 重置当前流程状态
      this._stateManager.resetState();
      
      // 初始化新流程
      this._stateManager.initNewFlow(flowId);
      
      // 保存用户输入的项目想法
      this._stateManager.updateProjectContext({ userIdea });
      
      // 更新视图
      await this._updateFlowView(workflow);
      
    } catch (error) {
      handleError(error, '启动流程失败');
      this._showWelcomePage();
    }
  }
  
  /**
   * 更新流程视图
   */
  private async _updateFlowView(workflow: IWorkflow): Promise<void> {
    if (!this._view) return;
    
    try {
      const flowState = this._stateManager.state;
      
      // 检查是否已完成所有步骤
      if (workflow.steps.length > 0 && flowState.currentStepIndex >= workflow.steps.length) {
        // 显示完成页面
        this._view.webview.html = this._htmlGenerator.getFlowCompletionHtml(workflow);
        return;
      }
      
      // 获取当前步骤
      const currentStep = workflow.steps[flowState.currentStepIndex];
      
      // 获取流程步骤映射
      const flowStepsMapping = this._mappingService.getFlowStepsMapping(workflow.id);
      
      // 查找对应的步骤映射信息
      const stepMapping = flowStepsMapping.find(sm => sm.id === currentStep.id) || {
        recommendedRoles: [],
        outputArtifacts: []
      };
      
      // 获取推荐角色
      const recommendedRoles = stepMapping.recommendedRoles || [];
      
      // 获取角色名称
      const roleNames = await Promise.all(recommendedRoles.map(async (roleId) => {
        const role = this._promptService.getRoleById(roleId);
        return role ? role.name : '';
      }));
      
      // 检查当前步骤是否已完成
      const isCompleted = this._stateManager.isStepCompleted(currentStep.id);
      
      // 生成角色卡片HTML
      const roleCardsHtml = this._htmlGenerator.getRoleCardsHtml(
        recommendedRoles,
        roleNames
      );
      
      // 生成并设置步骤视图HTML
      this._view.webview.html = await this._htmlGenerator.getStepViewHtml(
        workflow,
        currentStep,
        flowState.currentStepIndex,
        workflow.steps.length,
        recommendedRoles,
        isCompleted,
        roleCardsHtml
      );
      
    } catch (error) {
      handleError(error, '更新流程视图失败');
      this._showWelcomePage(String(error));
    }
  }
  
  /**
   * 移动到下一步
   */
  private async _moveToNextStep(): Promise<void> {
    try {
      // 显示加载指示器
      this._showLoading('准备下一步...');
      
      const flowState = this._stateManager.state;
      const workflow = this._workflowService.getWorkflowById(flowState.flowId);
      
      if (workflow && flowState.currentStepIndex < workflow.steps.length - 1) {
        this._stateManager.moveToNextStep();
        await this._updateFlowView(workflow);
      }
    } catch (error) {
      handleError(error, '移动到下一步失败');
    }
  }
  
  /**
   * 移动到上一步
   */
  private async _moveToPrevStep(): Promise<void> {
    try {
      // 显示加载指示器
      this._showLoading('返回上一步...');
      
      const flowState = this._stateManager.state;
      const workflow = this._workflowService.getWorkflowById(flowState.flowId);
      
      if (workflow && flowState.currentStepIndex > 0) {
        this._stateManager.moveToPrevStep();
        await this._updateFlowView(workflow);
      }
    } catch (error) {
      handleError(error, '移动到上一步失败');
    }
  }
  
  /**
   * 重置当前流程
   */
  private _resetFlow(): void {
    console.log('开始执行重置流程操作');
    try {
      // 重置状态管理器中的状态
      this._stateManager.resetState();
      console.log('状态已重置');
      
      vscode.window.showInformationMessage('流程已重置');
      console.log('流程重置成功');
    } catch (error) {
      handleError(error, '重置流程失败');
    }
  }
  
  /**
   * 完成当前步骤
   * @param output 步骤输出内容
   */
  private async _completeCurrentStep(output: Record<string, any>): Promise<void> {
    try {
      // 显示加载指示器
      this._showLoading('保存步骤进度...');
      
      const flowState = this._stateManager.state;
      const workflow = this._workflowService.getWorkflowById(flowState.flowId);
      
      if (workflow && flowState.currentStepIndex < workflow.steps.length) {
        const currentStep = workflow.steps[flowState.currentStepIndex];
        
        // 创建一个新的上下文对象，将步骤ID和输出路径关联起来
        const stepContext: Record<string, any> = {};
        
        // 如果有输出路径，存储为特定格式: stepId_outputPath
        if (output.outputPath) {
          stepContext[`${currentStep.id}_outputPath`] = output.outputPath;
        }
        
        // 将其他输出内容也添加到上下文中
        Object.keys(output).forEach(key => {
          if (key !== 'outputPath') {
            stepContext[key] = output[key];
          }
        });
        
        // 更新项目上下文
        this._stateManager.updateProjectContext(stepContext);
        
        // 标记步骤为已完成
        this._stateManager.addCompletedStep(currentStep.id);
        
        // 更新视图
        await this._updateFlowView(workflow);
      }
    } catch (error) {
      handleError(error, '完成步骤失败');
    }
  }
  
  /**
   * 应用角色提示词
   * @param roleId 角色ID
   */
  private async _applyRolePrompt(roleId: string): Promise<void> {
    try {
      // 显示加载指示器
      this._showLoading('应用角色提示词...');
      
      // 获取基础提示词内容
      const promptContent = await this._promptService.getPromptContent(roleId);
      
      if (promptContent) {
        // 获取当前流程状态
        const flowState = this._stateManager.state;
        
        // 获取当前工作流
        const workflow = this._workflowService.getWorkflowById(flowState.flowId);
        if (!workflow) {
          throw new Error(`找不到工作流: ${flowState.flowId}`);
        }
        
        // 获取当前步骤
        const currentStep = workflow.steps[flowState.currentStepIndex];
        
        // 准备要追加的上下文内容
        let contextContent = '';
        
        // 根据不同步骤追加不同上下文
        if (currentStep) {
          // 第一步：如果是产品经理角色，追加用户想法
          if (flowState.currentStepIndex === 0 && flowState.projectContext.userIdea) {
            contextContent += `\n\n我的想法是：${flowState.projectContext.userIdea}`;
          }
          
          // 非第一步：追加前面步骤的输出路径信息
          if (flowState.currentStepIndex > 0) {
            // 获取前面的步骤信息
            for (let i = 0; i < flowState.currentStepIndex; i++) {
              const prevStep = workflow.steps[i];
              // 检查该步骤是否已完成且有输出路径
              if (
                this._stateManager.isStepCompleted(prevStep.id) && 
                flowState.projectContext[`${prevStep.id}_outputPath`]
              ) {
                const outputPath = flowState.projectContext[`${prevStep.id}_outputPath`];
                const prevStepName = prevStep.name;
                
                // 追加前一步骤的输出路径信息
                contextContent += `\n\n${prevStepName}已经完成了工作，输出件目录位于${outputPath}，请你阅读该目录下的所有输出件，按照要求完成当前任务。`;
              }
            }
          }
          
          // 添加该步骤的上下文变量
          if (currentStep.contextVars && currentStep.contextVars.length > 0) {
            for (const contextVar of currentStep.contextVars) {
              if (contextVar !== 'userIdea' && flowState.projectContext[contextVar]) {
                contextContent += `\n\n${contextVar}: ${flowState.projectContext[contextVar]}`;
              }
            }
          }
        }
        
        // 将提示词和上下文结合
        const finalPrompt = promptContent + contextContent;
        
        // 插入到聊天窗口
        await insertPromptToChat(finalPrompt);
        
        // 显示成功消息
        vscode.window.showInformationMessage(`已应用角色提示词: ${roleId}`);
        
        // 恢复到之前的视图状态
        await this._updateFlowView(workflow);
      }
    } catch (error) {
      handleError(error, '应用角色提示词失败');
      
      // 错误时也恢复视图状态
      try {
        const flowState = this._stateManager.state;
        if (flowState.flowId) {
          const workflow = this._workflowService.getWorkflowById(flowState.flowId);
          if (workflow) {
            await this._updateFlowView(workflow);
          } else {
            this._showWelcomePage();
          }
        } else {
          this._showWelcomePage();
        }
      } catch (e) {
        this._showWelcomePage();
      }
    }
  }

  /**
   * 处理取消加载请求
   * 恢复到之前的视图状态
   */
  private async _handleCancelLoading(): Promise<void> {
    try {
      console.log('用户取消了操作');
      vscode.window.showInformationMessage('操作已取消');
      
      // 获取当前流程状态
      const flowState = this._stateManager.state;
      
      // 立即恢复到上一个状态页面
      if (!flowState.flowId) {
        // 如果没有活动流程，显示欢迎页面
        this._showWelcomePage();
      } else {
        // 有活动流程，恢复到当前步骤视图
        const workflow = this._workflowService.getWorkflowById(flowState.flowId);
        if (workflow) {
          await this._updateFlowView(workflow);
        } else {
          // 找不到工作流，显示欢迎页面
          this._showWelcomePage();
        }
      }
    } catch (error) {
      handleError(error, '取消加载失败');
      this._showWelcomePage();
    }
  }
}