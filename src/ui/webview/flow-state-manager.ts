import * as vscode from 'vscode';
import { IFlowState } from '../../interfaces';
import { handleError, log } from '../../utils';

/**
 * 流程状态管理器
 * 负责管理和持久化流程状态
 */
export class FlowStateManager {
  // 当前流程状态
  private _flowState: IFlowState = {
    flowId: '',
    currentStepIndex: 0,
    projectContext: {},
    completedSteps: []
  };
  
  // 存储键名前缀
  private readonly STORAGE_KEY_PREFIX = 'promptHelper.flowState';
  
  constructor(
    private readonly _context: vscode.ExtensionContext
  ) {
    // 尝试从持久化存储恢复状态
    this.restoreState();
  }
  
  /**
   * 获取当前流程状态
   */
  get state(): IFlowState {
    return { ...this._flowState };
  }
  
  /**
   * 设置流程ID
   */
  setFlowId(flowId: string): void {
    this._flowState.flowId = flowId;
    this.persistState();
  }
  
  /**
   * 设置当前步骤索引
   */
  setCurrentStepIndex(index: number): void {
    this._flowState.currentStepIndex = index;
    this.persistState();
  }
  
  /**
   * 添加已完成步骤
   */
  addCompletedStep(stepId: string): void {
    if (!this._flowState.completedSteps.includes(stepId)) {
      this._flowState.completedSteps.push(stepId);
      this.persistState();
    }
  }
  
  /**
   * 更新项目上下文
   */
  updateProjectContext(context: Record<string, any>): void {
    this._flowState.projectContext = {
      ...this._flowState.projectContext,
      ...context
    };
    this.persistState();
  }
  
  /**
   * 重置状态
   */
  resetState(): void {
    this._flowState = {
      flowId: '',
      currentStepIndex: 0,
      projectContext: {},
      completedSteps: []
    };
    this.persistState();
  }
  
  /**
   * 检查步骤是否已完成
   */
  isStepCompleted(stepId: string): boolean {
    return this._flowState.completedSteps.includes(stepId);
  }
  
  /**
   * 初始化新流程
   */
  initNewFlow(flowId: string): void {
    this._flowState = {
      flowId,
      currentStepIndex: 0,
      projectContext: {},
      completedSteps: []
    };
    this.persistState();
  }
  
  /**
   * 移动到下一步
   */
  moveToNextStep(): void {
    this._flowState.currentStepIndex++;
    this.persistState();
  }
  
  /**
   * 移动到上一步
   */
  moveToPrevStep(): void {
    if (this._flowState.currentStepIndex > 0) {
      this._flowState.currentStepIndex--;
      this.persistState();
    }
  }
  
  /**
   * 获取存储键名
   */
  private getStorageKey(): string {
    return `${this.STORAGE_KEY_PREFIX}`;
  }
  
  /**
   * 持久化存储流程状态
   */
  private persistState(): void {
    try {
      this._context.globalState.update(this.getStorageKey(), this._flowState);
      log('流程状态已持久化');
    } catch (error) {
      handleError(error, '持久化流程状态失败');
    }
  }
  
  /**
   * 从存储中恢复流程状态
   */
  private restoreState(): void {
    try {
      const savedState = this._context.globalState.get<IFlowState>(this.getStorageKey());
      if (savedState) {
        this._flowState = savedState;
        log('已从存储恢复流程状态');
      }
    } catch (error) {
      handleError(error, '恢复流程状态失败');
    }
  }
} 