/**
 * 测试入口文件
 */

import * as path from 'path';
import glob from 'glob';

// 创建测试运行器
export function run(): Promise<void> {
  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // 查找测试文件
    glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
      if (err) {
        return reject(err);
      }

      try {
        // 使用Jest而不是Mocha
        const jest = require('jest');
        const jestConfig = {
          testRegex: files.map(f => `${testsRoot}/${f}$`).join('|'),
          rootDir: process.cwd(),
          verbose: true
        };

        jest.run(['--config', JSON.stringify(jestConfig)]).then(() => {
          resolve();
        }).catch((error: any) => {
          reject(error);
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}