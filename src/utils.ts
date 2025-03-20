import * as vscode from 'vscode';

// 创建输出通道用于记录日志
const outputChannel = vscode.window.createOutputChannel('PromptMaster ');

/**
 * 记录日志到输出通道
 */
export function log(message: string, showInUI: boolean = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  outputChannel.appendLine(logMessage);
  console.log(logMessage);
  
  if (showInUI) {
    outputChannel.show();
  }
}

/**
 * 将提示词插入到Cursor的聊天窗口
 * 使用已经确认有效的命令
 * @param content 要插入的提示词内容
 */
export async function insertPromptToChat(content: string): Promise<void> {
  try {
    log('开始执行插入提示词操作');
    
    // 保存当前剪贴板内容
    const originalClipboard = await vscode.env.clipboard.readText();
    log('已保存原始剪贴板内容');
    
    // 将提示词内容复制到剪贴板
    await vscode.env.clipboard.writeText(content);
    log('已将提示词复制到剪贴板');
    
    // 使用确认有效的命令激活聊天窗口
    log('使用workbench.panel.aichat.view.focus命令激活聊天窗口');
    await vscode.commands.executeCommand('workbench.panel.aichat.view.focus');
    
    // 等待聊天窗口激活
    log('等待聊天窗口激活(800ms)');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 尝试粘贴
    log('执行粘贴操作');
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    log('粘贴命令执行成功');
    
    // 延迟一段时间后恢复剪贴板
    log('设置10秒后恢复剪贴板');
    setTimeout(async () => {
      try {
        await vscode.env.clipboard.writeText(originalClipboard);
        log('已恢复原始剪贴板内容');
      } catch (err) {
        log(`恢复剪贴板失败: ${err}`);
      }
    }, 10000); // 10秒后恢复，给用户足够时间
    
  } catch (error) {
    // 捕获并处理错误
    log(`插入提示词错误: ${error}`);
    
    // 尝试恢复剪贴板
    try {
      const originalClipboard = await vscode.env.clipboard.readText();
      await vscode.env.clipboard.writeText(originalClipboard);
      log('已恢复原始剪贴板内容');
    } catch (clipErr) {
      log(`恢复剪贴板时出错: ${clipErr}`);
    }
    
    // 重新抛出错误
    throw error;
  }
}

/**
 * 从角色ID中提取角色名称
 * 例如：从"9-2-VSCode插件开发工程师角色提示词"提取"VSCode插件开发工程师"
 * @param roleId 角色ID
 * @returns 提取后的角色名称
 */
export function extractRoleNameFromId(roleId: string): string {
  // 移除数字前缀 (例如 "9-2-")
  let roleName = roleId.replace(/^\d+-\d+-/, '').replace(/^\d+-/, '');
  
  // 移除"角色提示词"后缀
  roleName = roleName.replace(/角色提示词$/, '');
  
  return roleName;
}

/**
 * 统一处理错误并显示错误消息
 * @param error 错误对象
 * @param message 错误消息前缀
 * @param showToUser 是否显示给用户
 */
export function handleError(error: any, message: string, showToUser: boolean = true): void {
  const errorMessage = `${message}: ${error}`;
  log(errorMessage, true);
  
  if (showToUser) {
    vscode.window.showErrorMessage(errorMessage);
  }
} 