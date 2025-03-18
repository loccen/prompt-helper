/**
 * 测试运行文件
 * 用于运行VS Code扩展的测试
 */

import * as path from 'path';
import * as cp from 'child_process';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron';

/**
 * 主函数
 */
async function main() {
  try {
    // VS Code 的根目录
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // 测试文件的路径
    const extensionTestsPath = path.resolve(__dirname, './index');

    // 下载 VS Code, 解压, 然后以集成测试模式运行
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    // 使用子进程运行 VS Code
    cp.spawnSync(
      cliPath,
      [...args, '--install-extension', 'dbaeumer.vscode-eslint'],
      {
        encoding: 'utf-8',
        stdio: 'inherit'
      }
    );

    // 运行扩展测试
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions'
      ]
    });
  } catch (err) {
    console.error('运行测试时发生错误:', err);
    process.exit(1);
  }
}

main(); 