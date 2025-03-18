import { IFlowState } from '../../interfaces';

/**
 * FlowStateManager的模拟实现
 */
export class MockFlowStateManager {
  private _state: IFlowState = {
    flowId: '',
    currentStepIndex: 0,
    completedSteps: [],
    projectContext: {}
  };
  
  /**
   * 获取当前状态
   */
  public get state(): IFlowState {
    return this._state;
  }
  
  /**
   * 重置状态
   */
  public resetState(): void {
    this._state = {
      flowId: '',
      currentStepIndex: 0,
      completedSteps: [],
      projectContext: {}
    };
  }
  
  /**
   * 更新状态
   * @param newState 新状态
   */
  public updateState(newState: Partial<IFlowState>): void {
    this._state = {
      ...this._state,
      ...newState
    };
  }
  
  /**
   * 更新流程ID
   * @param flowId 流程ID
   */
  public updateFlowId(flowId: string): void {
    this._state.flowId = flowId;
  }
  
  /**
   * 更新当前步骤索引
   * @param index 步骤索引
   */
  public updateCurrentStepIndex(index: number): void {
    this._state.currentStepIndex = index;
  }
  
  /**
   * 添加已完成步骤
   * @param stepId 步骤ID
   */
  public addCompletedStep(stepId: string): void {
    if (!this._state.completedSteps.includes(stepId)) {
      this._state.completedSteps.push(stepId);
    }
  }
  
  /**
   * 更新项目上下文
   * @param context 上下文数据
   */
  public updateProjectContext(context: Record<string, any>): void {
    this._state.projectContext = {
      ...this._state.projectContext,
      ...context
    };
  }
  
  /**
   * 初始化新流程
   * @param flowId 流程ID
   */
  public initNewFlow(flowId: string): void {
    this._state = {
      flowId,
      currentStepIndex: 0,
      completedSteps: [],
      projectContext: {}
    };
  }
} 