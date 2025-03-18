import * as vscode from 'vscode';
import { FlowStateManager } from '../../../../ui/webview/flow-state-manager';
import { TestUtils } from '../../../utils/test-utils';
import { IFlowState } from '../../../../interfaces';

// 模拟utils.ts中的函数
jest.mock('../../../../utils', () => ({
  handleError: jest.fn(),
  log: jest.fn()
}));

describe('FlowStateManager', () => {
  let stateManager: FlowStateManager;
  let mockContext: vscode.ExtensionContext;
  
  beforeEach(() => {
    // 创建模拟的扩展上下文
    mockContext = TestUtils.createMockExtensionContext() as unknown as vscode.ExtensionContext;
    
    // 创建要测试的FlowStateManager实例
    stateManager = new FlowStateManager(mockContext);
  });
  
  test('初始状态应为空', () => {
    const state = stateManager.state;
    
    expect(state.flowId).toBe('');
    expect(state.currentStepIndex).toBe(0);
    expect(state.completedSteps).toEqual([]);
    expect(state.projectContext).toEqual({});
  });
  
  test('应正确设置流程ID', () => {
    stateManager.setFlowId('test-flow');
    
    const state = stateManager.state;
    expect(state.flowId).toBe('test-flow');
    
    // 验证状态被持久化
    expect(mockContext.globalState.update).toHaveBeenCalled();
  });
  
  test('应正确设置当前步骤索引', () => {
    stateManager.setCurrentStepIndex(2);
    
    const state = stateManager.state;
    expect(state.currentStepIndex).toBe(2);
    
    // 验证状态被持久化
    expect(mockContext.globalState.update).toHaveBeenCalled();
  });
  
  test('应正确添加已完成步骤', () => {
    stateManager.addCompletedStep('step1');
    stateManager.addCompletedStep('step2');
    
    const state = stateManager.state;
    expect(state.completedSteps).toContain('step1');
    expect(state.completedSteps).toContain('step2');
    expect(state.completedSteps.length).toBe(2);
    
    // 验证状态被持久化
    expect(mockContext.globalState.update).toHaveBeenCalledTimes(2);
  });
  
  test('应不重复添加已完成步骤', () => {
    stateManager.addCompletedStep('step1');
    stateManager.addCompletedStep('step1');
    
    const state = stateManager.state;
    expect(state.completedSteps).toEqual(['step1']);
    
    // 验证状态只被持久化一次
    expect(mockContext.globalState.update).toHaveBeenCalledTimes(1);
  });
  
  test('应正确更新项目上下文', () => {
    stateManager.updateProjectContext({ key1: 'value1' });
    
    let state = stateManager.state;
    expect(state.projectContext).toEqual({ key1: 'value1' });
    
    // 更新部分上下文应该合并
    stateManager.updateProjectContext({ key2: 'value2' });
    
    state = stateManager.state;
    expect(state.projectContext).toEqual({ 
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  test('应正确重置状态', () => {
    // 先设置一些状态
    stateManager.setFlowId('test-flow');
    stateManager.setCurrentStepIndex(2);
    stateManager.addCompletedStep('step1');
    
    // 重置状态
    stateManager.resetState();
    
    // 验证状态被重置
    const state = stateManager.state;
    expect(state.flowId).toBe('');
    expect(state.currentStepIndex).toBe(0);
    expect(state.completedSteps).toEqual([]);
    expect(state.projectContext).toEqual({});
  });
  
  test('应正确检查步骤是否已完成', () => {
    stateManager.addCompletedStep('step1');
    
    expect(stateManager.isStepCompleted('step1')).toBe(true);
    expect(stateManager.isStepCompleted('step2')).toBe(false);
  });
  
  test('应正确初始化新流程', () => {
    // 先设置一些状态
    stateManager.setFlowId('old-flow');
    stateManager.setCurrentStepIndex(2);
    stateManager.addCompletedStep('step1');
    stateManager.updateProjectContext({ key: 'value' });
    
    // 初始化新流程
    stateManager.initNewFlow('new-flow');
    
    // 验证状态被重置并设置新流程
    const state = stateManager.state;
    expect(state.flowId).toBe('new-flow');
    expect(state.currentStepIndex).toBe(0);
    expect(state.completedSteps).toEqual([]);
    expect(state.projectContext).toEqual({});
  });
  
  test('应正确移动到下一步', () => {
    stateManager.setCurrentStepIndex(1);
    
    stateManager.moveToNextStep();
    
    expect(stateManager.state.currentStepIndex).toBe(2);
  });
  
  test('应正确移动到上一步', () => {
    stateManager.setCurrentStepIndex(2);
    
    stateManager.moveToPrevStep();
    
    expect(stateManager.state.currentStepIndex).toBe(1);
  });
  
  test('移动到上一步时不应该允许负索引', () => {
    stateManager.setCurrentStepIndex(0);
    
    stateManager.moveToPrevStep();
    
    expect(stateManager.state.currentStepIndex).toBe(0);
  });
  
  test('应从存储中恢复状态', () => {
    // 模拟已保存的状态
    const savedState: IFlowState = {
      flowId: 'saved-flow',
      currentStepIndex: 3,
      completedSteps: ['step1', 'step2'],
      projectContext: { key: 'value' }
    };
    
    // 模拟获取已保存的状态
    (mockContext.globalState.get as jest.Mock).mockReturnValue(savedState);
    
    // 创建新实例，应该从存储中恢复状态
    const newStateManager = new FlowStateManager(mockContext);
    
    // 验证状态被恢复
    const state = newStateManager.state;
    expect(state.flowId).toBe('saved-flow');
    expect(state.currentStepIndex).toBe(3);
    expect(state.completedSteps).toEqual(['step1', 'step2']);
    expect(state.projectContext).toEqual({ key: 'value' });
  });
});