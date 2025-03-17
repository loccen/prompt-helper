import * as vscode from 'vscode';
import * as path from 'path';
import { IWorkflow } from '../../interfaces';
import { extractRoleNameFromId } from '../../utils';

/**
 * 开发流程引导器HTML生成器
 * 负责生成各种页面的HTML
 */
export class DevFlowHtmlGenerator {
  constructor(
    private readonly extensionUri: vscode.Uri
  ) {}

  /**
   * 获取欢迎页面HTML
   * @param errorMessage 错误消息
   */
  getWelcomePageHtml(workflows: IWorkflow[], errorMessage?: string): string {
    // 获取CSS和JS资源URI
    const styleMainUri = this.getResourceUri('media/styles.css');
    
    // 构建工作流卡片HTML
    const workflowCardsHtml = workflows.map(workflow => `
      <div class="workflow-card" data-workflow-id="${workflow.id}">
        <h3>${workflow.name}</h3>
        <p>${workflow.description}</p>
        <button class="start-workflow-btn">启动流程</button>
      </div>
    `).join('');
    
    // 构建错误提示HTML
    const errorHtml = errorMessage ? `
      <div class="error-message">
        <p>发生错误: ${errorMessage}</p>
      </div>
    ` : '';
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>开发流程引导器</title>
        <link rel="stylesheet" href="${styleMainUri}">
      </head>
      <body>
        <div class="container">
          <div class="welcome-section">
            <h2>项目开发流程</h2>
            <p>选择一个流程来开始您的项目开发</p>
            ${errorHtml}
          </div>
          
          <div class="workflows-container">
            ${workflowCardsHtml}
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 启动工作流按钮点击处理
            document.querySelectorAll('.start-workflow-btn').forEach(btn => {
              btn.addEventListener('click', (event) => {
                const workflowCard = event.target.closest('.workflow-card');
                const workflowId = workflowCard.dataset.workflowId;
                vscode.postMessage({
                  command: 'startFlow',
                  flowId: workflowId
                });
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取步骤视图HTML
   * @param workflow 工作流
   * @param currentStep 当前步骤
   * @param currentStepIndex 当前步骤索引
   * @param totalSteps 总步骤数
   * @param recommendedRoles 推荐角色
   * @param isCompleted 是否已完成
   */
  async getStepViewHtml(
    workflow: IWorkflow, 
    currentStep: any, 
    currentStepIndex: number, 
    totalSteps: number,
    recommendedRoles: string[],
    isCompleted: boolean,
    roleCardsHtml: string
  ): Promise<string> {
    // 获取CSS和JS资源URI
    const styleMainUri = this.getResourceUri('media/styles.css');
    
    // 计算进度百分比
    const progressPercent = Math.round((currentStepIndex / (totalSteps - 1)) * 100);
    
    // 构建按钮HTML
    const prevButtonDisabled = currentStepIndex === 0 ? 'disabled' : '';
    const nextButtonDisabled = currentStepIndex === totalSteps - 1 ? 'disabled' : '';
    const completeButtonDisabled = isCompleted ? 'disabled' : '';
    const completeButtonText = isCompleted ? '已完成' : '标记为完成';
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>开发流程引导器</title>
        <link rel="stylesheet" href="${styleMainUri}">
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${workflow.name}</h2>
            <button class="reset-btn" title="重置流程">重置</button>
          </div>
          
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress" style="width: ${progressPercent}%"></div>
            </div>
            <div class="step-info">
              步骤 ${currentStepIndex + 1}/${totalSteps}
            </div>
          </div>
          
          <div class="step-container">
            <h3 class="step-title">${currentStep.name}</h3>
            <p class="step-description">${currentStep.description}</p>
            
            <div class="step-controls">
              <button class="prev-btn" ${prevButtonDisabled}>上一步</button>
              <button class="complete-btn" ${completeButtonDisabled}>${completeButtonText}</button>
              <button class="next-btn" ${nextButtonDisabled}>下一步</button>
            </div>
          </div>
          
          <div class="roles-section">
            <h3>推荐角色</h3>
            <div class="roles-container">
              ${roleCardsHtml}
            </div>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 上一步按钮点击处理
            document.querySelector('.prev-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'prevStep'
              });
            });
            
            // 下一步按钮点击处理
            document.querySelector('.next-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'nextStep'
              });
            });
            
            // 完成按钮点击处理
            document.querySelector('.complete-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'completeStep'
              });
            });
            
            // 重置按钮点击处理
            document.querySelector('.reset-btn').addEventListener('click', () => {
              if (confirm('确定要重置当前流程吗？这将清除所有进度。')) {
                vscode.postMessage({
                  command: 'resetFlow'
                });
              }
            });
            
            // 角色卡片点击处理
            document.querySelectorAll('.role-card').forEach(card => {
              card.addEventListener('click', (event) => {
                const roleId = event.currentTarget.dataset.roleId;
                vscode.postMessage({
                  command: 'applyRolePrompt',
                  roleId: roleId
                });
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取角色卡片HTML
   * @param roleIds 角色ID列表
   * @param roleNames 角色名称列表
   */
  getRoleCardsHtml(roleIds: string[], roleNames: string[]): string {
    if (roleIds.length === 0) {
      return `<p class="no-roles">此步骤没有推荐角色</p>`;
    }
    
    return roleIds.map((roleId, index) => {
      const roleName = roleNames[index] || extractRoleNameFromId(roleId);
      return `
        <div class="role-card" data-role-id="${roleId}">
          <div class="role-icon">👤</div>
          <div class="role-name">${roleName}</div>
          <div class="role-action">应用</div>
        </div>
      `;
    }).join('');
  }

  /**
   * 获取流程完成HTML
   * @param workflow 工作流
   */
  getFlowCompletionHtml(workflow: IWorkflow): string {
    // 获取CSS和JS资源URI
    const styleMainUri = this.getResourceUri('media/styles.css');
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>开发流程引导器</title>
        <link rel="stylesheet" href="${styleMainUri}">
      </head>
      <body>
        <div class="container">
          <div class="completion-container">
            <div class="completion-icon">🎉</div>
            <h2>恭喜，您已完成 ${workflow.name} 流程！</h2>
            <p>您已经成功完成了所有开发步骤。</p>
            
            <div class="completion-actions">
              <button class="reset-btn">重新开始</button>
            </div>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 重置按钮点击处理
            document.querySelector('.reset-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'resetFlow'
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取资源URI
   * @param relativePath 相对路径
   */
  private getResourceUri(relativePath: string): vscode.Uri {
    return this.extensionUri
      .with({ path: path.join(this.extensionUri.path, relativePath) });
  }
}