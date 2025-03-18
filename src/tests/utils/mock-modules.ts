/**
 * 测试模块模拟
 * 用于在测试中模拟依赖模块
 */

import * as path from 'path';

/**
 * 设置所有测试所需的模拟模块
 */
export function setupMocks() {
  // 模拟 vscode 模块
  jest.mock('vscode', () => {
    return {
      window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showInputBox: jest.fn(),
        createOutputChannel: jest.fn().mockReturnValue({
          appendLine: jest.fn(),
          append: jest.fn(),
          show: jest.fn(),
          dispose: jest.fn()
        }),
        createWebviewPanel: jest.fn().mockReturnValue({
          webview: {
            html: '',
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn().mockResolvedValue(true),
            options: {}
          },
          onDidDispose: jest.fn(),
          onDidChangeViewState: jest.fn(),
          reveal: jest.fn(),
          dispose: jest.fn()
        }),
        registerWebviewViewProvider: jest.fn()
      },
      commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn()
      },
      workspace: {
        getConfiguration: jest.fn().mockReturnValue({
          get: jest.fn(),
          update: jest.fn().mockResolvedValue(undefined),
          has: jest.fn()
        }),
        workspaceFolders: [],
        onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() })
      },
      Uri: {
        parse: jest.fn().mockImplementation(uri => ({ 
          toString: () => uri,
          fsPath: uri.replace(/^file:\/\//, ''),
          scheme: uri.startsWith('file://') ? 'file' : 'untitled'
        })),
        file: jest.fn().mockImplementation(path => ({ 
          path, 
          fsPath: path,
          scheme: 'file',
          with: jest.fn().mockReturnThis()
        }))
      },
      EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn()
      })),
      ThemeIcon: jest.fn(),
      TreeItem: jest.fn().mockImplementation((label) => ({
        label,
        description: '',
        tooltip: '',
        command: undefined,
        collapsibleState: 0,
        contextValue: ''
      })),
      TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
      },
      Disposable: {
        from: jest.fn().mockReturnValue({ dispose: jest.fn() })
      },
      ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2
      },
      env: {
        clipboard: {
          readText: jest.fn(),
          writeText: jest.fn()
        }
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
      }
    };
  }, { virtual: true });

  // 模拟 fs 模块
  jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue(''),
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockReturnValue({ isDirectory: () => false })
  }));

  // 模拟全局项目工具模块
  jest.mock('../../utils', () => ({
    log: jest.fn(),
    handleError: jest.fn(),
    insertPromptToChat: jest.fn().mockResolvedValue(undefined)
  }), { virtual: true });
}

/**
 * 重置所有模拟的状态
 */
export function resetAllMocks() {
  jest.clearAllMocks();
}

/**
 * 创建模拟的扩展上下文
 */
export function createMockExtensionContext() {
  const storage = new Map<string, any>();
  
  return {
    subscriptions: [],
    extensionPath: '/mock/extension/path',
    extensionUri: { fsPath: '/mock/extension/path', scheme: 'file' },
    globalState: {
      get: jest.fn().mockImplementation(key => storage.get(key)),
      update: jest.fn().mockImplementation((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      setKeysForSync: jest.fn()
    },
    workspaceState: {
      get: jest.fn().mockImplementation(key => storage.get(key)),
      update: jest.fn().mockImplementation((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      })
    },
    asAbsolutePath: jest.fn().mockImplementation(relativePath => {
      return path.join('/mock/extension/path', relativePath);
    }),
    logPath: '/mock/extension/logs',
    logUri: { fsPath: '/mock/extension/logs', scheme: 'file' },
    storageUri: { fsPath: '/mock/extension/storage', scheme: 'file' },
    globalStorageUri: { fsPath: '/mock/extension/globalStorage', scheme: 'file' }
  };
} 