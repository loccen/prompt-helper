/**
 * 测试工具函数
 * 提供用于测试的辅助函数和工具
 */

import * as vscode from '../mocks/vscode';

/**
 * 创建模拟的 VSCode 扩展上下文
 * @returns 模拟的扩展上下文
 */
export function createMockExtensionContext() {
  return new vscode.ExtensionContext();
}

/**
 * 等待指定时间
 * @param ms 等待的毫秒数
 * @returns Promise
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 模拟 VSCode 用户输入
 * @param inputValue 用户输入的值
 * @returns 配置好的 showInputBox 模拟
 */
export function mockUserInput(inputValue: string | undefined) {
  (vscode.window as any).showInputBox = jest.fn().mockResolvedValue(inputValue);
  return vscode.window.showInputBox;
}

/**
 * 捕获控制台输出
 * @param fn 要执行的函数
 * @returns 捕获的控制台输出
 */
export async function captureConsoleOutput(fn: () => Promise<void> | void): Promise<string[]> {
  const outputs: string[] = [];
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.log = (...args) => outputs.push(['log', ...args].join(' '));
  console.info = (...args) => outputs.push(['info', ...args].join(' '));
  console.warn = (...args) => outputs.push(['warn', ...args].join(' '));
  console.error = (...args) => outputs.push(['error', ...args].join(' '));

  try {
    await fn();
    return outputs;
  } finally {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
}

/**
 * 创建模拟的 WebviewPanel
 * @returns 模拟的 WebviewPanel
 */
export function createMockWebviewPanel() {
  const postMessageSpy = jest.fn().mockResolvedValue(true);
  const onDidReceiveMessageSpy = jest.fn();
  const disposeSpy = jest.fn();
  
  const panel = {
    webview: {
      html: '',
      options: { enableScripts: true },
      postMessage: postMessageSpy,
      onDidReceiveMessage: onDidReceiveMessageSpy
    },
    onDidDispose: jest.fn(),
    onDidChangeViewState: jest.fn(),
    reveal: jest.fn(),
    dispose: disposeSpy
  };
  
  // 模拟触发消息处理
  const triggerMessageFromWebview = (message: any) => {
    const handlers = onDidReceiveMessageSpy.mock.calls
      .map(call => call[0])
      .filter(handler => typeof handler === 'function');
    
    handlers.forEach(handler => handler(message));
  };
  
  return {
    panel,
    postMessageSpy,
    onDidReceiveMessageSpy,
    disposeSpy,
    triggerMessageFromWebview
  };
}

/**
 * 重置所有 VSCode API 模拟
 */
export function resetVSCodeMocks() {
  jest.resetAllMocks();
  
  // 重置特定模拟
  vscode.window.showInformationMessage.mockReset();
  vscode.window.showErrorMessage.mockReset();
  vscode.window.showWarningMessage.mockReset();
  vscode.commands.registerCommand.mockReset();
  vscode.commands.executeCommand.mockReset();
  
  if ((vscode.window as any).showInputBox) {
    (vscode.window as any).showInputBox.mockReset();
  }
} 