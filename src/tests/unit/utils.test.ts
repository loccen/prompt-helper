import * as vscode from 'vscode';
import * as utils from '../../utils';

// 提取需要测试的函数，避免导入问题
const { log, insertPromptToChat, extractRoleNameFromId, handleError } = utils;

// 创建全局模拟对象
let mockOutputChannel: any;
let mockClipboard: any;
let mockCommands: any;
let mockWindow: any;

// 模拟vscode的命令
jest.mock('vscode', () => {
  return {
    window: {
      createOutputChannel: jest.fn(() => mockOutputChannel),
      showErrorMessage: jest.fn()
    },
    commands: {
      executeCommand: jest.fn()
    },
    env: {
      clipboard: {
        readText: jest.fn(),
        writeText: jest.fn()
      }
    },
    Uri: {
      joinPath: jest.fn(),
      parse: jest.fn()
    }
  };
});

describe('工具函数测试', () => {
  // 在每个测试前重置所有模拟
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置定时器
    jest.useFakeTimers();
    
    // 创建新的模拟对象
    mockOutputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    };
    
    mockClipboard = {
      readText: jest.fn().mockResolvedValue('原始剪贴板内容'),
      writeText: jest.fn().mockResolvedValue(undefined)
    };
    
    mockCommands = {
      executeCommand: jest.fn().mockResolvedValue(undefined)
    };
    
    mockWindow = {
      showErrorMessage: jest.fn()
    };
    
    // 重置模拟对象
    (vscode.window.createOutputChannel as jest.Mock).mockReturnValue(mockOutputChannel);
    (vscode.env.clipboard.readText as jest.Mock).mockImplementation(mockClipboard.readText);
    (vscode.env.clipboard.writeText as jest.Mock).mockImplementation(mockClipboard.writeText);
    (vscode.commands.executeCommand as jest.Mock).mockImplementation(mockCommands.executeCommand);
    (vscode.window.showErrorMessage as jest.Mock).mockImplementation(mockWindow.showErrorMessage);
  });
  
  afterEach(() => {
    // 恢复真实定时器
    jest.useRealTimers();
  });
  
  describe('log函数', () => {
    test('应正确记录日志信息', () => {
      // 执行log函数
      log('测试日志消息');
      
      // 验证输出通道记录
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('测试日志消息')
      );
      
      // 验证不显示UI
      expect(mockOutputChannel.show).not.toHaveBeenCalled();
    });
    
    test('带showInUI参数应显示输出通道', () => {
      // 执行log函数并显示UI
      log('测试日志消息', true);
      
      // 验证输出通道显示
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });
  });
  
  describe('insertPromptToChat函数', () => {
    test('应正确插入提示词到聊天', async () => {
      // 执行插入提示词函数
      await insertPromptToChat('测试提示词内容');
      
      // 验证保存原始剪贴板内容
      expect(vscode.env.clipboard.readText).toHaveBeenCalled();
      
      // 验证写入提示词到剪贴板
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('测试提示词内容');
      
      // 验证激活聊天窗口
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.panel.aichat.view.focus');
      
      // 验证粘贴命令
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('editor.action.clipboardPasteAction');
      
      // 前进定时器10秒
      jest.advanceTimersByTime(10000);
      
      // 验证恢复原始剪贴板内容
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('原始剪贴板内容');
    });
    
    test('出错时应恢复剪贴板', async () => {
      // 模拟粘贴命令出错
      (vscode.commands.executeCommand as jest.Mock)
        .mockImplementationOnce(() => Promise.reject(new Error('模拟粘贴错误')));
      
      // 执行插入提示词函数并捕获错误
      await expect(insertPromptToChat('测试提示词内容')).rejects.toThrow('模拟粘贴错误');
      
      // 验证尝试恢复剪贴板
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('原始剪贴板内容');
    });
  });
  
  describe('extractRoleNameFromId函数', () => {
    test('应正确提取角色名称', () => {
      // 测试不同格式的角色ID
      expect(extractRoleNameFromId('9-2-VSCode插件开发工程师角色提示词')).toBe('VSCode插件开发工程师');
      expect(extractRoleNameFromId('1-产品经理角色提示词')).toBe('产品经理');
      expect(extractRoleNameFromId('简单角色提示词')).toBe('简单');
      expect(extractRoleNameFromId('前端开发')).toBe('前端开发');
    });
  });
  
  describe('handleError函数', () => {
    test('应正确记录错误并在UI中显示', () => {
      // 执行handleError函数
      const error = new Error('测试错误');
      handleError(error, '操作失败');
      
      // 验证记录日志
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('操作失败: Error: 测试错误')
      );
      
      // 验证显示UI错误消息
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('操作失败: Error: 测试错误')
      );
      
      // 验证显示输出通道
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });
    
    test('设置showToUser=false时不显示UI错误消息', () => {
      // 执行handleError函数但不显示UI
      const error = new Error('测试错误');
      handleError(error, '操作失败', false);
      
      // 验证记录日志
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('操作失败: Error: 测试错误')
      );
      
      // 验证不显示UI错误消息
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });
}); 