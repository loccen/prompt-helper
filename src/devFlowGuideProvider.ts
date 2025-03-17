import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PromptProvider } from './promptProvider';
import { WorkflowProvider, IWorkflow } from './workflowProvider';
import { insertPromptToChat } from './utils';

/**
 * 项目流程步骤数据接口
 */
interface IFlowStep {
  id: string;
  name: string;
  description: string;
  recommendedRoles: string[];
  outputArtifacts: string[];
}

/**
 * 流程状态接口
 */
interface IFlowState {
  flowId: string;
  currentStepIndex: number;
  projectContext: Record<string, any>;
  completedSteps: string[];
}

/**
 * 项目开发流程引导器
 * 提供可视化界面引导用户完成项目开发流程
 */
export class DevFlowGuideProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'promptHelper.devFlowGuide';
  private _view?: vscode.WebviewView;
  
  // 存储当前用户的项目流程状态
  private _flowState: IFlowState = {
    flowId: '',
    currentStepIndex: 0,
    projectContext: {},
    completedSteps: []
  };
  
  // 流程步骤与角色映射配置文件路径
  private _flowStepsMappingFile: string;
  
  // 流程步骤映射数据
  private _flowStepsMapping: Record<string, { steps: IFlowStep[] }> = {};
  
  // 存储键名前缀
  private readonly STORAGE_KEY_PREFIX = 'promptHelper.flowState';
  
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _promptProvider: PromptProvider,
    private readonly _workflowProvider: WorkflowProvider,
    private readonly _context: vscode.ExtensionContext
  ) {
    this._flowStepsMappingFile = path.join(this._extensionUri.fsPath, 'data', 'flow-steps-mapping.json');
    this._loadFlowStepsMapping();
    
    // 尝试从持久化存储恢复状态
    this._restoreFlowState();
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
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };
    
    // 尝试从持久化存储恢复状态
    this._restoreFlowState();
    
    // 根据当前状态决定显示欢迎页还是步骤页
    if (this._flowState.flowId) {
      // 已有活动流程，尝试恢复显示
      this._workflowProvider.getWorkflows().then(workflows => {
        const workflow = workflows.find(wf => wf.id === this._flowState.flowId);
        if (workflow) {
          this._updateFlowView(workflow);
        } else {
          // 找不到对应工作流，显示欢迎页
          webviewView.webview.html = this._getWelcomePageHtml();
        }
      });
    } else {
      // 初始首页内容
      webviewView.webview.html = this._getWelcomePageHtml();
    }
    
    // 处理来自WebView的消息
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'selectFlow':
          this._startNewFlow(message.flowId);
          break;
        case 'nextStep':
          this._moveToNextStep();
          break;
        case 'prevStep':
          this._moveToPrevStep();
          break;
        case 'applyPrompt':
          this._applyRolePrompt(message.roleId);
          break;
        case 'completeStep':
          this._completeCurrentStep(message.output || {});
          break;
        case 'restartFlow':
          this._resetFlow();
          break;
        case 'setProjectContext':
          this._updateProjectContext(message.context);
          break;
      }
    });
  }
  
  /**
   * 开始一个新的开发流程
   */
  private async _startNewFlow(flowId: string): Promise<void> {
    try {
      // 重置流程状态
      this._flowState = {
        flowId,
        currentStepIndex: 0,
        projectContext: {},
        completedSteps: []
      };
      
      // 获取用户输入的项目信息
      const userIdea = await vscode.window.showInputBox({
        prompt: '请输入您的项目/产品想法',
        placeHolder: '例如：一个帮助开发者管理代码片段的工具'
      });
      
      if (!userIdea) {
        this._view!.webview.html = this._getWelcomePageHtml('请输入项目想法以开始流程');
        return;
      }
      
      // 更新项目上下文
      this._flowState.projectContext.userIdea = userIdea;
      
      // 持久化保存状态
      this._persistFlowState();
      
      // 获取流程数据并更新视图
      const workflows = await this._workflowProvider.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowId);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      // 更新视图
      this._updateFlowView(workflow);
      
      // 显示成功消息
      vscode.window.showInformationMessage(`已启动开发流程: ${workflow.name}`);
      
    } catch (error) {
      vscode.window.showErrorMessage(`启动流程失败: ${error}`);
      this._view!.webview.html = this._getWelcomePageHtml(
        `启动流程失败: ${error}`
      );
    }
  }
  
  /**
   * 更新流程视图
   */
  private async _updateFlowView(workflow: IWorkflow): Promise<void> {
    try {
      const { currentStepIndex, completedSteps } = this._flowState;
      const currentStep = workflow.steps[currentStepIndex];
      
      if (!currentStep) {
        this._view!.webview.html = this._getFlowCompletionHtml(workflow);
        return;
      }
      
      // 获取推荐角色
      let recommendedRoles: string[] = [];
      
      if (this._flowStepsMapping[workflow.id]) {
        const stepData = this._flowStepsMapping[workflow.id].steps[currentStepIndex];
        recommendedRoles = stepData?.recommendedRoles || [currentStep.role];
      } else {
        recommendedRoles = [currentStep.role];
      }
      
      // 构建HTML视图
      this._view!.webview.html = await this._getStepViewHtml(
        workflow,
        currentStep,
        currentStepIndex,
        workflow.steps.length,
        recommendedRoles,
        completedSteps.includes(currentStep.id)
      );
      
    } catch (error) {
      vscode.window.showErrorMessage(`更新流程视图失败: ${error}`);
    }
  }
  
  /**
   * 应用角色提示词到聊天窗口
   */
  private async _applyRolePrompt(roleId: string): Promise<void> {
    try {
      // 获取当前工作流和步骤
      const { flowId, currentStepIndex } = this._flowState;
      const workflows = await this._workflowProvider.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowId);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      const currentStep = workflow.steps[currentStepIndex];
      
      // 获取角色提示词内容
      const promptContent = await this._promptProvider.getPromptContent(roleId);
      
      if (!promptContent) {
        throw new Error(`找不到角色提示词: ${roleId}`);
      }
      
      // 构建上下文附加信息
      let contextInfo = '';
      
      // 获取当前角色名称
      const currentRoleName = this._getRoleNameFromId(roleId);
      
      // 如果是当前步骤的角色，添加上下文变量内容
      if (currentStep && currentStep.role === roleId && currentStep.contextVars) {
        for (const varName of currentStep.contextVars) {
          const varValue = this._flowState.projectContext[varName];
          if (varValue && typeof varValue === 'string') {
            // 为每个变量添加格式化的内容
            switch(varName) {
              case 'userIdea':
                contextInfo += `\n\n我的项目想法是：${varValue}\n`;
                break;
              case 'requirementsOutput':
                contextInfo += `\n\n需求分析结果：\n${varValue}\n`;
                break;
              case 'designOutput':
                contextInfo += `\n\n设计方案：\n${varValue}\n`;
                break;
              case 'previousStepOutput':
                contextInfo += `\n\n上一步骤输出：\n${varValue}\n`;
                break;
              default:
                contextInfo += `\n\n${varName}：${varValue}\n`;
            }
          }
        }
        
        // 处理前一步骤的输出目录信息
        const roleDirPaths = this._flowState.projectContext['roleDirPaths'] as Record<string, string>;
        if (roleDirPaths && typeof roleDirPaths === 'object') {
          let dirPathInfo = '';
          
          // 如果是流程中第二步及以后的步骤，添加输出件目录信息
          if (currentStepIndex > 0) {
            const prevStep = workflow.steps[currentStepIndex - 1];
            if (prevStep) {
              const prevRoleName = this._getRoleNameFromId(prevStep.role);
              const prevRoleDirPath = roleDirPaths[prevRoleName];
              
              if (prevRoleDirPath) {
                dirPathInfo += `\n\n目录'${prevRoleDirPath}'下的文件为${prevRoleName}给出的输出件，请你作为${currentRoleName}，仔细阅读相关文档，根据这些内容继续你的工作。\n`;
              }
            }
          }
          
          // 如果当前步骤需要参考多个之前步骤的输出
          if (currentStep.contextVars && currentStep.contextVars.length > 1) {
            for (const varName of currentStep.contextVars) {
              // 查找是否有对应的角色目录路径
              if (varName !== 'userIdea' && varName !== 'previousStepOutput') {
                const roleName = varName.replace('Output', ''); // 例如 requirementsOutput -> requirements
                
                // 遍历已有的角色目录，找到可能相关的角色
                for (const [existingRoleName, dirPath] of Object.entries(roleDirPaths)) {
                  if (existingRoleName.toLowerCase().includes(roleName.toLowerCase()) && 
                      !dirPathInfo.includes(dirPath)) {
                    dirPathInfo += `\n\n目录'${dirPath}'下的文件为${existingRoleName}提供的相关文档，请参考这些内容。\n`;
                  }
                }
              }
            }
          }
          
          // 添加目录信息到上下文
          if (dirPathInfo) {
            contextInfo += dirPathInfo;
          }
        }
      }
      
      // 完整的提示词 = 角色提示词 + 上下文信息
      let formattedPrompt = promptContent;
      
      // 如果有上下文信息，添加到提示词的末尾
      if (contextInfo) {
        formattedPrompt += contextInfo;
      }
      
      console.log('项目上下文:', this._flowState.projectContext);
      console.log('添加的上下文信息:', contextInfo);
      
      // 插入到聊天窗口
      await insertPromptToChat(formattedPrompt);
      
      // 显示成功消息
      vscode.window.showInformationMessage(`已插入角色提示词`);
      
    } catch (error) {
      vscode.window.showErrorMessage(`应用角色提示词失败: ${error}`);
      console.error('应用角色提示词失败:', error);
    }
  }
  
  /**
   * 将当前步骤标记为已完成
   */
  private async _completeCurrentStep(output: Record<string, any> = {}): Promise<void> {
    try {
      const { flowId, currentStepIndex } = this._flowState;
      
      // 获取当前工作流和步骤
      const workflows = await this._workflowProvider.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowId);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      const currentStep = workflow.steps[currentStepIndex];
      
      if (!currentStep) {
        throw new Error('当前没有活动步骤');
      }
      
      // 如果步骤已完成且用户没有提供新输出，询问是否要编辑
      if (this._flowState.completedSteps.includes(currentStep.id) && Object.keys(output).length === 0) {
        const action = await vscode.window.showQuickPick(
          ['修改输出路径', '取消'],
          { placeHolder: '此步骤已完成，您想要做什么？' }
        );
        
        if (!action || action === '取消') {
          return;
        }
        // 如果用户选择修改，继续后续逻辑
      }
      
      // 如果用户没有提供输出，获取输出件目录路径
      if (Object.keys(output).length === 0) {
        // 获取输出目录路径
        const outputDirPath = await vscode.window.showInputBox({
          prompt: `请输入此步骤(${currentStep.name})的输出件目录路径（相对于项目根目录）`,
          placeHolder: '例如: docs/产品经理, src/designs 等',
          ignoreFocusOut: true // 防止用户切换窗口导致对话框关闭
        });
        
        // 如果用户取消了输入，直接返回
        if (outputDirPath === undefined) {
          return;
        }
        
        // 创建输出对象
        const userOutput: Record<string, any> = {};
        const roleName = this._getRoleNameFromId(currentStep.role);
        
        // 即使输出路径为空字符串也记录
        // 生成一个描述性文本作为步骤输出
        const stepDescription = `${roleName}已完成${currentStep.name}，输出件位于${outputDirPath || '根目录'}`;
        
        // 存储描述
        userOutput[`${currentStep.id}_output`] = stepDescription;
        
        // 根据步骤类型，添加特定的上下文变量
        switch(currentStep.id) {
          case 'step-1':
          case 'requirements-analysis':
            userOutput['requirementsOutput'] = stepDescription;
            break;
          case 'step-2':
          case 'architecture-design':
          case 'ui-design':
          case 'plugin-design':
          case 'extension-design':
            userOutput['designOutput'] = stepDescription;
            break;
          default:
            // 其他步骤使用通用输出变量
            userOutput['previousStepOutput'] = stepDescription;
        }
        
        // 存储目录路径
        userOutput[`${currentStep.id}_dirPath`] = outputDirPath;
        userOutput[`${roleName}_dirPath`] = outputDirPath;
        
        // 更新角色目录路径映射
        const existingRoleDirPaths = (this._flowState.projectContext['roleDirPaths'] as Record<string, string>) || {};
        userOutput['roleDirPaths'] = {
          ...existingRoleDirPaths,
          [roleName]: outputDirPath
        };
        
        // 更新输出对象
        output = userOutput;
      }
      
      // 仅当有有效输出时才更新状态
      if (Object.keys(output).length > 0) {
        // 更新完成状态
        if (!this._flowState.completedSteps.includes(currentStep.id)) {
          this._flowState.completedSteps.push(currentStep.id);
        }
        
        // 更新项目上下文
        this._flowState.projectContext = {
          ...this._flowState.projectContext,
          ...output,
          // 始终提供当前步骤信息
          currentStepName: currentStep.name,
          currentStepId: currentStep.id,
          stepIndex: currentStepIndex.toString()
        };
        
        // 持久化保存状态
        this._persistFlowState();
        
        // 显示上下文信息（调试用）
        console.log('项目上下文已更新:', this._flowState.projectContext);
        
        // 更新视图
        this._updateFlowView(workflow);
        
        // 显示成功消息
        vscode.window.showInformationMessage(`已完成当前步骤: ${currentStep.name}`);
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(`完成步骤失败: ${error}`);
    }
  }
  
  /**
   * 从角色ID中提取角色名称
   */
  private _getRoleNameFromId(roleId: string): string {
    // 移除数字前缀 (例如 "9-2-")
    let roleName = roleId.replace(/^\d+-\d+-/, '').replace(/^\d+-/, '');
    
    // 移除"角色提示词"后缀
    roleName = roleName.replace(/角色提示词$/, '');
    
    return roleName;
  }
  
  /**
   * 移动到下一个步骤
   */
  private async _moveToNextStep(): Promise<void> {
    try {
      const { flowId, currentStepIndex } = this._flowState;
      
      // 获取当前工作流
      const workflows = await this._workflowProvider.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowId);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      // 检查是否已到达最后一步
      if (currentStepIndex >= workflow.steps.length - 1) {
        this._view!.webview.html = this._getFlowCompletionHtml(workflow);
        return;
      }
      
      // 更新步骤索引
      this._flowState.currentStepIndex++;
      
      // 持久化保存状态
      this._persistFlowState();
      
      // 更新视图
      this._updateFlowView(workflow);
      
    } catch (error) {
      vscode.window.showErrorMessage(`移动到下一步失败: ${error}`);
    }
  }
  
  /**
   * 移动到上一个步骤
   */
  private async _moveToPrevStep(): Promise<void> {
    try {
      const { flowId, currentStepIndex } = this._flowState;
      
      // 检查是否已经是第一步
      if (currentStepIndex <= 0) {
        return;
      }
      
      // 获取当前工作流
      const workflows = await this._workflowProvider.getWorkflows();
      const workflow = workflows.find(wf => wf.id === flowId);
      
      if (!workflow) {
        throw new Error(`找不到工作流: ${flowId}`);
      }
      
      // 更新步骤索引
      this._flowState.currentStepIndex--;
      
      // 持久化保存状态
      this._persistFlowState();
      
      // 更新视图
      this._updateFlowView(workflow);
      
    } catch (error) {
      vscode.window.showErrorMessage(`移动到上一步失败: ${error}`);
    }
  }
  
  /**
   * 重置当前流程
   */
  private _resetFlow(): void {
    // 清空当前流程状态
    this._flowState = {
      flowId: '',
      currentStepIndex: 0,
      projectContext: {},
      completedSteps: []
    };
    
    // 持久化保存状态（清空）
    try {
      const storageKey = this._getStorageKey();
      this._context.workspaceState.update(storageKey, this._flowState);
      console.log(`已清空流程状态: ${storageKey}`);
    } catch (error) {
      console.error('清空流程状态失败:', error);
    }
    
    // 重置视图
    this._view!.webview.html = this._getWelcomePageHtml();
  }
  
  /**
   * 更新项目上下文
   */
  private _updateProjectContext(context: Record<string, any>): void {
    this._flowState.projectContext = {
      ...this._flowState.projectContext,
      ...context
    };
    
    // 持久化保存状态
    try {
      const storageKey = this._getStorageKey();
      this._context.workspaceState.update(storageKey, this._flowState);
      console.log(`已更新项目上下文: ${storageKey}`);
    } catch (error) {
      console.error('更新项目上下文失败:', error);
    }
  }
  
  /**
   * 加载流程步骤映射数据
   */
  private _loadFlowStepsMapping(): void {
    try {
      // 确保目录存在
      const dataDir = path.dirname(this._flowStepsMappingFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // 检查文件是否存在
      if (fs.existsSync(this._flowStepsMappingFile)) {
        const content = fs.readFileSync(this._flowStepsMappingFile, 'utf-8');
        this._flowStepsMapping = JSON.parse(content);
      } else {
        // 如果文件不存在，创建默认配置
        this._createDefaultFlowStepsMapping();
      }
    } catch (error) {
      console.error('加载流程步骤映射失败:', error);
    }
  }
  
  /**
   * 创建默认流程步骤映射配置
   */
  private _createDefaultFlowStepsMapping(): void {
    try {
      const defaultMapping = {
        "standard-project": {
          "steps": [
            {
              "id": "requirements-analysis",
              "name": "需求分析",
              "description": "明确项目目标和功能需求",
              "recommendedRoles": ["1-产品经理角色提示词"],
              "outputArtifacts": ["需求文档", "用户故事"]
            },
            {
              "id": "architecture-design",
              "name": "架构设计",
              "description": "设计系统架构和技术方案",
              "recommendedRoles": ["2-系统架构师角色提示词"],
              "outputArtifacts": ["架构文档", "技术方案"]
            },
            {
              "id": "development",
              "name": "开发实现",
              "description": "编写代码实现功能",
              "recommendedRoles": ["6-0-后端开发工程师角色提示词", "5-1-Web前端开发工程师角色提示词"],
              "outputArtifacts": ["源代码", "API文档"]
            },
            {
              "id": "testing",
              "name": "测试验证",
              "description": "测试功能和性能",
              "recommendedRoles": ["7-测试工程师角色提示词"],
              "outputArtifacts": ["测试报告", "Bug列表"]
            }
          ]
        },
        "frontend-project": {
          "steps": [
            {
              "id": "requirements-analysis",
              "name": "需求分析",
              "description": "明确前端项目的目标和功能需求",
              "recommendedRoles": ["1-产品经理角色提示词"],
              "outputArtifacts": ["需求文档", "用户故事"]
            },
            {
              "id": "ui-design",
              "name": "UI设计",
              "description": "设计用户界面和交互流程",
              "recommendedRoles": ["3-UI设计师角色提示词"],
              "outputArtifacts": ["界面原型", "设计规范"]
            },
            {
              "id": "frontend-development",
              "name": "前端开发",
              "description": "实现前端界面和交互",
              "recommendedRoles": ["5-1-Web前端开发工程师角色提示词"],
              "outputArtifacts": ["前端代码", "组件库"]
            }
          ]
        },
        "vscode-plugin": {
          "steps": [
            {
              "id": "requirements-analysis",
              "name": "需求分析",
              "description": "明确VSCode插件的目标和功能需求",
              "recommendedRoles": ["1-产品经理角色提示词", "9-2-VSCode插件开发工程师角色提示词"],
              "outputArtifacts": ["需求文档", "功能列表"]
            },
            {
              "id": "plugin-design",
              "name": "插件设计",
              "description": "设计插件架构和功能模块",
              "recommendedRoles": ["9-2-VSCode插件开发工程师角色提示词", "2-系统架构师角色提示词"],
              "outputArtifacts": ["架构文档", "API设计"]
            },
            {
              "id": "plugin-development",
              "name": "插件开发",
              "description": "实现插件功能",
              "recommendedRoles": ["9-2-VSCode插件开发工程师角色提示词"],
              "outputArtifacts": ["插件源码", "package.json"]
            }
          ]
        },
        "browser-extension": {
          "steps": [
            {
              "id": "requirements-analysis",
              "name": "需求分析",
              "description": "明确浏览器插件的目标和功能需求",
              "recommendedRoles": ["1-产品经理角色提示词", "9-1-浏览器插件开发工程师角色提示词"],
              "outputArtifacts": ["需求文档", "功能列表"]
            },
            {
              "id": "extension-design",
              "name": "插件设计",
              "description": "设计插件架构和功能模块",
              "recommendedRoles": ["9-1-浏览器插件开发工程师角色提示词", "2-系统架构师角色提示词"],
              "outputArtifacts": ["架构文档", "API设计"]
            },
            {
              "id": "extension-development",
              "name": "插件开发",
              "description": "实现插件功能",
              "recommendedRoles": ["9-1-浏览器插件开发工程师角色提示词", "5-1-Web前端开发工程师角色提示词"],
              "outputArtifacts": ["插件源码", "manifest.json"]
            }
          ]
        }
      };
      
      // 写入默认配置
      fs.writeFileSync(
        this._flowStepsMappingFile, 
        JSON.stringify(defaultMapping, null, 2),
        'utf-8'
      );
      
      this._flowStepsMapping = defaultMapping;
      
    } catch (error) {
      console.error('创建默认流程步骤映射失败:', error);
    }
  }
  
  /**
   * 获取欢迎页面HTML
   */
  private _getWelcomePageHtml(errorMessage?: string): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>项目开发流程引导</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          background-color: var(--vscode-editor-background);
          color: var(--vscode-foreground);
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: var(--vscode-editor-foreground);
          font-size: 1.5em;
          margin-bottom: 16px;
        }
        p {
          margin-bottom: 16px;
        }
        .error {
          color: var(--vscode-errorForeground);
          background-color: var(--vscode-inputValidation-errorBackground);
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 16px;
        }
        .flow-card {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .flow-card:hover {
          background-color: var(--vscode-editor-selectionBackground);
        }
        .flow-card h3 {
          margin-top: 0;
          color: var(--vscode-editor-foreground);
        }
        .flow-card p {
          color: var(--vscode-descriptionForeground);
          font-size: 0.9em;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 2px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h1>项目开发流程引导</h1>
      ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
      <p>欢迎使用Prompt-Helper 的项目开发流程引导。请选择一个开发流程开始:</p>
      
      <div class="flow-card" onclick="selectFlow('standard-project')">
        <h3>标准项目开发流程</h3>
        <p>从需求分析到实现的标准项目开发流程</p>
      </div>
      
      <div class="flow-card" onclick="selectFlow('frontend-project')">
        <h3>前端项目开发流程</h3>
        <p>从需求到前端实现的专用流程</p>
      </div>
      
      <div class="flow-card" onclick="selectFlow('vscode-plugin')">
        <h3>VSCode插件开发流程</h3>
        <p>VSCode插件开发的专用流程</p>
      </div>
      
      <div class="flow-card" onclick="selectFlow('browser-extension')">
        <h3>浏览器插件开发流程</h3>
        <p>浏览器插件开发的专用流程</p>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function selectFlow(flowId) {
          vscode.postMessage({
            command: 'selectFlow',
            flowId: flowId
          });
        }
      </script>
    </body>
    </html>`;
  }
  
  /**
   * 获取步骤视图HTML
   */
  private async _getStepViewHtml(
    workflow: IWorkflow, 
    currentStep: any, 
    currentStepIndex: number, 
    totalSteps: number,
    recommendedRoles: string[],
    isCompleted: boolean
  ): Promise<string> {
    // 获取角色卡片HTML (现在是异步的)
    const roleCardsHtml = await this._getRoleCardsHtml(recommendedRoles);
    
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>项目开发流程引导</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          background-color: var(--vscode-editor-background);
          color: var(--vscode-foreground);
          padding: 20px;
          line-height: 1.6;
        }
        h1, h2, h3 {
          color: var(--vscode-editor-foreground);
        }
        .progress-bar {
          background-color: var(--vscode-progressBar-background);
          height: 6px;
          margin: 20px 0;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          background-color: var(--vscode-activityBarBadge-background);
          height: 100%;
          width: ${Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%;
          transition: width 0.3s;
        }
        .step-info {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        .step-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0;
        }
        .step-nav-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .roles-container {
          margin-top: 24px;
        }
        .role-card {
          background-color: var(--vscode-editor-selectionBackground);
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
        }
        .role-card:hover {
          background-color: var(--vscode-editorWidget-background);
        }
        .role-icon {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: var(--vscode-activityBarBadge-background);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          font-weight: bold;
        }
        .role-content {
          flex: 1;
        }
        .no-roles-message {
          background-color: var(--vscode-inputValidation-infoBackground);
          color: var(--vscode-inputValidation-infoForeground);
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 16px;
          border-left: 4px solid var(--vscode-inputValidation-infoBorder);
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 2px;
          margin-right: 8px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .completed-badge {
          background-color: var(--vscode-activityBarBadge-background);
          color: var(--vscode-activityBarBadge-foreground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.8em;
          margin-left: 8px;
        }
      </style>
    </head>
    <body>
      <h1>${workflow.name}</h1>
      <p>${workflow.description}</p>
      
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      
      <div class="step-info">
        <h2>步骤 ${currentStepIndex + 1}/${totalSteps}: ${currentStep.name} ${isCompleted ? '<span class="completed-badge">已完成</span>' : ''}</h2>
        <p>${currentStep.description}</p>
      </div>
      
      <div class="roles-container">
        <h3>推荐角色</h3>
        <p>选择一个角色来获取相应的提示词:</p>
        
        ${roleCardsHtml}
      </div>
      
      <div class="step-nav">
        <div class="step-nav-group">
          ${currentStepIndex > 0 ? `<button onclick="prevStep()">上一步</button>` : ''}
          ${!isCompleted ? `<button onclick="completeStep()">标记为已完成</button>` : ''}
        </div>
        <div class="step-nav-group">
          ${currentStepIndex < totalSteps - 1 ? `<button onclick="nextStep()">下一步</button>` : ''}
          <button class="secondary" onclick="restartFlow()">重新开始</button>
        </div>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function applyPrompt(roleId) {
          vscode.postMessage({
            command: 'applyPrompt',
            roleId: roleId
          });
        }
        
        function nextStep() {
          vscode.postMessage({
            command: 'nextStep'
          });
        }
        
        function prevStep() {
          vscode.postMessage({
            command: 'prevStep'
          });
        }
        
        function completeStep() {
          vscode.postMessage({
            command: 'completeStep'
          });
        }
        
        function restartFlow() {
          vscode.postMessage({
            command: 'restartFlow'
          });
        }
      </script>
    </body>
    </html>`;
  }
  
  /**
   * 获取角色卡片HTML
   */
  private async _getRoleCardsHtml(roleIds: string[]): Promise<string> {
    let html = '';
    
    // 验证角色是否存在并收集有效角色
    const validRoleIds: string[] = [];
    
    for (const roleId of roleIds) {
      try {
        const content = await this._promptProvider.getPromptContent(roleId);
        if (content) {
          validRoleIds.push(roleId);
        } else {
          console.warn(`角色提示词不存在: ${roleId}`);
        }
      } catch (e) {
        console.warn(`检查角色提示词失败: ${roleId}`, e);
      }
    }
    
    // 如果没有有效角色，添加通用提示
    if (validRoleIds.length === 0) {
      return `<div class="no-roles-message">
        <p>当前步骤没有可用的角色提示词。</p>
        <p>您可以使用已有角色继续，或者添加自定义角色提示词。</p>
      </div>`;
    }
    
    // 生成有效角色的卡片
    for (const roleId of validRoleIds) {
      // 从角色ID提取名称
      const roleName = this._extractRoleNameFromId(roleId);
      
      // 获取角色头像字母
      const initial = roleName.charAt(0).toUpperCase();
      
      html += `
      <div class="role-card" onclick="applyPrompt('${roleId}')">
        <div class="role-icon">${initial}</div>
        <div class="role-content">
          <h3>${roleName}</h3>
          <p>点击应用此角色提示词</p>
        </div>
      </div>`;
    }
    
    return html;
  }
  
  /**
   * 从角色ID中提取名称
   */
  private _extractRoleNameFromId(roleId: string): string {
    // 移除数字前缀 (例如 "9-2-")
    let roleName = roleId.replace(/^\d+-\d+-/, '').replace(/^\d+-/, '');
    
    // 移除"角色提示词"后缀
    roleName = roleName.replace(/角色提示词$/, '');
    
    return roleName;
  }
  
  /**
   * 获取流程完成页面HTML
   */
  private _getFlowCompletionHtml(workflow: IWorkflow): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>项目开发流程引导</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          background-color: var(--vscode-editor-background);
          color: var(--vscode-foreground);
          padding: 20px;
          line-height: 1.6;
          text-align: center;
        }
        h1 {
          color: var(--vscode-editor-foreground);
        }
        .completion-icon {
          font-size: 48px;
          color: var(--vscode-activityBarBadge-background);
          margin: 20px 0;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 2px;
          margin-top: 20px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h1>恭喜！您已完成 ${workflow.name}</h1>
      <div class="completion-icon">🎉</div>
      <p>您已成功完成了该项目开发流程的所有步骤。</p>
      <button onclick="restartFlow()">选择新的开发流程</button>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function restartFlow() {
          vscode.postMessage({
            command: 'restartFlow'
          });
        }
      </script>
    </body>
    </html>`;
  }
  
  /**
   * 生成当前工作区的唯一存储键
   * 使用工作区文件夹路径作为唯一标识
   */
  private _getStorageKey(): string {
    let workspaceId = 'default';
    
    // 获取当前工作区文件夹路径作为唯一ID
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workspaceId = vscode.workspace.workspaceFolders[0].uri.fsPath;
      
      // 对路径进行简单处理避免特殊字符
      workspaceId = workspaceId.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    return `${this.STORAGE_KEY_PREFIX}.${workspaceId}`;
  }
  
  /**
   * 将流程状态持久化保存
   */
  private _persistFlowState(): void {
    try {
      // 获取当前工作区的存储键
      const storageKey = this._getStorageKey();
      
      // 将状态保存到工作区状态存储
      this._context.workspaceState.update(storageKey, this._flowState);
      
      console.log(`已保存流程状态到: ${storageKey}`);
    } catch (error) {
      console.error('保存流程状态失败:', error);
    }
  }
  
  /**
   * 从持久化存储恢复流程状态
   */
  private _restoreFlowState(): void {
    try {
      // 获取当前工作区的存储键
      const storageKey = this._getStorageKey();
      
      // 从工作区状态存储中获取保存的状态
      const savedState = this._context.workspaceState.get<IFlowState>(storageKey);
      
      if (savedState) {
        console.log(`已恢复流程状态从: ${storageKey}`);
        this._flowState = savedState;
      }
    } catch (error) {
      console.error('恢复流程状态失败:', error);
    }
  }
} 