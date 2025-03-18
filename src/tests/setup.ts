/**
 * 全局测试设置文件
 * 用于模拟VSCode API和设置全局测试配置
 */
import { setupMocks } from './utils/mock-modules';

// 设置所有测试所需的模拟
setupMocks();

// 全局测试前置设置
global.beforeEach(() => {
  jest.clearAllMocks();
}); 