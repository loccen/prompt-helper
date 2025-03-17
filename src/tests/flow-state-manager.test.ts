import * as assert from 'assert';
import * as vscode from 'vscode';
import { FlowStateManager } from '../ui/webview/flow-state-manager';

// 创建Mock ExtensionContext
const createMockContext = () => {
  const mockStorage = new Map<string, any>();
  
  return {
    globalState: {
      get<T>(key: string): T | undefined {
        return mockStorage.get(key) as T;
      },
      update(key: string, value: any): Thenable<void> {
        mockStorage.set(key, value);
        return Promise.resolve();
      }
    }
  } as unknown as vscode.ExtensionContext;
};

suite('FlowStateManager 测试套件', () => {
  let stateManager: FlowStateManager;
  let mockContext: vscode.ExtensionContext;
  
  setup(() => {
    mockContext = createMockContext();
    stateManager = new FlowStateManager(mockContext);
  });
  
  test('初始状态应该是空的', () => {
    const state = stateManager.state;
    
    assert.strictEqual(state.flowId, '');
    assert.strictEqual(state.currentStepIndex, 0);
    assert.deepStrictEqual(state.projectContext, {});
    assert.deepStrictEqual(state.completedSteps, []);
  });
  
  test('设置流程ID应该正确更新状态', () => {
    const testFlowId = 'test-flow';
    
    stateManager.setFlowId(testFlowId);
    
    const state = stateManager.state;
    assert.strictEqual(state.flowId, testFlowId);
  });
  
  test('设置当前步骤索引应该正确更新状态', () => {
    const testIndex = 2;
    
    stateManager.setCurrentStepIndex(testIndex);
    
    const state = stateManager.state;
    assert.strictEqual(state.currentStepIndex, testIndex);
  });
  
  test('添加已完成步骤应该正确更新状态', () => {
    const testStepId = 'test-step';
    
    stateManager.addCompletedStep(testStepId);
    
    const state = stateManager.state;
    assert.strictEqual(state.completedSteps.length, 1);
    assert.strictEqual(state.completedSteps[0], testStepId);
  });
  
  test('更新项目上下文应该正确合并数据', () => {
    const initialContext = { key1: 'value1' };
    const additionalContext = { key2: 'value2' };
    
    stateManager.updateProjectContext(initialContext);
    stateManager.updateProjectContext(additionalContext);
    
    const state = stateManager.state;
    assert.deepStrictEqual(state.projectContext, {
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  test('重置状态应该清空所有数据', () => {
    // 设置一些初始值
    stateManager.setFlowId('test-flow');
    stateManager.setCurrentStepIndex(2);
    stateManager.addCompletedStep('test-step');
    stateManager.updateProjectContext({ key: 'value' });
    
    // 重置状态
    stateManager.resetState();
    
    // 验证状态已重置
    const state = stateManager.state;
    assert.strictEqual(state.flowId, '');
    assert.strictEqual(state.currentStepIndex, 0);
    assert.deepStrictEqual(state.projectContext, {});
    assert.deepStrictEqual(state.completedSteps, []);
  });
  
  test('初始化新流程应该设置正确的初始状态', () => {
    const testFlowId = 'test-flow';
    
    // 设置一些初始值
    stateManager.setCurrentStepIndex(2);
    stateManager.addCompletedStep('test-step');
    stateManager.updateProjectContext({ key: 'value' });
    
    // 初始化新流程
    stateManager.initNewFlow(testFlowId);
    
    // 验证状态已正确初始化
    const state = stateManager.state;
    assert.strictEqual(state.flowId, testFlowId);
    assert.strictEqual(state.currentStepIndex, 0);
    assert.deepStrictEqual(state.projectContext, {});
    assert.deepStrictEqual(state.completedSteps, []);
  });
  
  test('移动到下一步应该增加步骤索引', () => {
    stateManager.setCurrentStepIndex(1);
    
    stateManager.moveToNextStep();
    
    const state = stateManager.state;
    assert.strictEqual(state.currentStepIndex, 2);
  });
  
  test('移动到上一步应该减少步骤索引', () => {
    stateManager.setCurrentStepIndex(2);
    
    stateManager.moveToPrevStep();
    
    const state = stateManager.state;
    assert.strictEqual(state.currentStepIndex, 1);
  });
  
  test('移动到上一步不应低于0', () => {
    stateManager.setCurrentStepIndex(0);
    
    stateManager.moveToPrevStep();
    
    const state = stateManager.state;
    assert.strictEqual(state.currentStepIndex, 0);
  });
  
  test('isStepCompleted应该正确检查步骤完成状态', () => {
    const testStepId = 'test-step';
    
    // 初始状态应为未完成
    assert.strictEqual(stateManager.isStepCompleted(testStepId), false);
    
    // 添加到已完成步骤
    stateManager.addCompletedStep(testStepId);
    
    // 现在应该报告为已完成
    assert.strictEqual(stateManager.isStepCompleted(testStepId), true);
  });
}); 