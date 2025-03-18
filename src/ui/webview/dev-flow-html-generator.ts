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
    const styleMainUri = this.getResourceUri('resources/media/styles.css');
    
    // 构建工作流卡片HTML
    const workflowCardsHtml = workflows.map(workflow => {
      // 根据工作流类型选择图标
      let workflowIcon = '📋';
      if (workflow.id.includes('front') || workflow.id.includes('web')) {
        workflowIcon = '🖥️';
      } else if (workflow.id.includes('vscode') || workflow.id.includes('extension')) {
        workflowIcon = '🧩';
      } else if (workflow.id.includes('browser')) {
        workflowIcon = '🌐';
      } else if (workflow.id.includes('server') || workflow.id.includes('backend')) {
        workflowIcon = '⚙️';
      }
      
      // 获取步骤数量
      const stepsCount = workflow.steps.length;
      
      return `
        <div class="workflow-card" data-workflow-id="${workflow.id}">
          <div class="workflow-icon">${workflowIcon}</div>
          <h3>${workflow.name}</h3>
          <p>${workflow.description}</p>
          <div class="workflow-meta">
            <span class="workflow-steps">${stepsCount} 个步骤</span>
          </div>
          <button class="start-workflow-btn">启动流程</button>
        </div>
      `;
    }).join('');
    
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
            <h2>项目开发流程引导器</h2>
            <p>选择一个流程开始您的项目开发之旅。每个流程将引导您完成从构思到实现的全部步骤。</p>
            ${errorHtml}
          </div>
          
          <div class="workflows-container">
            ${workflowCardsHtml}
          </div>
          
          <div class="welcome-footer">
            <p class="tip-text">💡 提示：每个流程都由专业角色提供指导，帮助您一步步完成项目开发。</p>
            <p class="tip-text">💾 您的进度将自动保存，可以随时继续上次的工作。</p>
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
            
            // 添加淡入动画效果
            document.querySelectorAll('.workflow-card').forEach((card, index) => {
              card.style.animationDelay = index * 0.1 + 's';
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
    const styleMainUri = this.getResourceUri('resources/media/styles.css');
    
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
      
      // 增加角色图标，根据角色名称选择不同的图标
      let roleIcon = '👤';
      
      if (roleName.includes('产品')) {
        roleIcon = '📝';
      } else if (roleName.includes('架构')) {
        roleIcon = '🏗️';
      } else if (roleName.includes('设计')) {
        roleIcon = '🎨';
      } else if (roleName.includes('前端')) {
        roleIcon = '🖥️';
      } else if (roleName.includes('后端')) {
        roleIcon = '⚙️';
      } else if (roleName.includes('全栈')) {
        roleIcon = '🔄';
      } else if (roleName.includes('测试')) {
        roleIcon = '🧪';
      } else if (roleName.includes('运维') || roleName.includes('DevOps')) {
        roleIcon = '🚀';
      } else if (roleName.includes('数据库')) {
        roleIcon = '💾';
      }
      
      return `
        <div class="role-card" data-role-id="${roleId}">
          <div class="role-icon">${roleIcon}</div>
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
    const styleMainUri = this.getResourceUri('resources/media/styles.css');
    
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
            <h2 class="completion-title">项目开发流程已完成！</h2>
            <p class="completion-message">
              恭喜！您已成功完成了 <strong>${workflow.name}</strong> 的全部开发步骤。
              您的项目已经从构思阶段经历了完整的开发流程，建议查看各步骤生成的文档和代码，以便继续完善您的项目。
            </p>
            
            <div class="completion-summary">
              <h3>流程回顾</h3>
              <div class="steps-summary">
                ${workflow.steps.map((step, index) => `
                  <div class="step-item">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                      <div class="step-name">${step.name}</div>
                      <div class="step-role">角色：${extractRoleNameFromId(step.role)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="completion-actions">
              <button class="new-flow-btn">开始新的项目流程</button>
              <button class="reset-btn">重新开始当前流程</button>
            </div>
          </div>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 重置按钮点击处理
            document.querySelector('.reset-btn').addEventListener('click', () => {
              if (confirm('确定要重置当前流程吗？这将清除所有进度。')) {
                vscode.postMessage({
                  command: 'resetFlow'
                });
              }
            });
            
            // 新流程按钮点击处理
            document.querySelector('.new-flow-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'newFlow'
              });
            });
            
            // 添加淡入动画效果
            document.querySelectorAll('.step-item').forEach((item, index) => {
              item.style.animationDelay = index * 0.1 + 's';
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
  public getResourceUri(relativePath: string): vscode.Uri {
    return this.extensionUri
      .with({ path: path.join(this.extensionUri.path, relativePath) });
  }
}