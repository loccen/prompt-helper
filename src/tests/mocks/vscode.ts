/**
 * VS Code API 模拟
 * 用于在测试环境中模拟 VS Code 的 API
 */

export class Uri {
  public readonly scheme: string;
  public readonly path: string;
  public readonly fsPath: string;
  
  constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
    this.fsPath = path;
  }
  
  public with(change: { scheme?: string; path?: string }): Uri {
    return new Uri(
      change.scheme || this.scheme,
      change.path || this.path
    );
  }
  
  public toString(): string {
    return `${this.scheme}://${this.path}`;
  }
  
  public static file(path: string): Uri {
    return new Uri('file', path);
  }
  
  public static parse(uri: string): Uri {
    const match = uri.match(/^([a-z]+):\/\/(.+)$/);
    if (match) {
      return new Uri(match[1], match[2]);
    }
    return new Uri('file', uri);
  }
}

export class Disposable {
  public static from(...disposables: { dispose(): any }[]): Disposable {
    return new Disposable(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
  }
  
  constructor(private readonly callOnDispose: Function) {}
  
  public dispose(): any {
    this.callOnDispose();
  }
}

export class EventEmitter<T> {
  private readonly listeners: ((e: T) => any)[] = [];
  
  public event(listener: (e: T) => any): Disposable {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    });
  }
  
  public fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const window = {
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
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn().mockResolvedValue(true),
      html: '',
      options: {}
    },
    onDidDispose: jest.fn(),
    onDidChangeViewState: jest.fn(),
    reveal: jest.fn(),
    dispose: jest.fn()
  }),
  registerWebviewViewProvider: jest.fn()
};

export const commands = {
  registerCommand: jest.fn().mockReturnValue(new Disposable(() => {})),
  executeCommand: jest.fn()
};

export const workspace = {
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    has: jest.fn()
  }),
  workspaceFolders: [],
  onDidChangeConfiguration: jest.fn().mockReturnValue(new Disposable(() => {}))
};

export const ExtensionContext = jest.fn().mockImplementation(() => {
  const storage = new Map<string, any>();
  return {
    subscriptions: [],
    extensionPath: '/fake/path',
    extensionUri: Uri.parse('file:///fake/path'),
    globalState: {
      get: jest.fn(key => storage.get(key)),
      update: jest.fn((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      setKeysForSync: jest.fn()
    },
    workspaceState: {
      get: jest.fn(key => storage.get(key)),
      update: jest.fn((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      })
    },
    asAbsolutePath: jest.fn(path => `/fake/path/${path}`)
  };
});

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3
}

export class CancellationTokenSource {
  public readonly token = { isCancellationRequested: false };
  
  public cancel(): void {
    (this.token as any).isCancellationRequested = true;
  }
  
  public dispose(): void {}
}

export const extensions = {
  getExtension: jest.fn()
};

// 导出模拟的 VS Code API
export default {
  Uri,
  Disposable,
  EventEmitter,
  window,
  commands,
  workspace,
  ExtensionContext,
  ViewColumn,
  CancellationTokenSource,
  extensions
}; 