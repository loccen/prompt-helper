# Prompt-Helper 测试文档

本文档描述了 Prompt-Helper 项目的测试架构和运行测试的方法。

## 测试架构

项目采用了多层次的测试架构，包括：

1. **单元测试**：测试独立的组件和服务
2. **集成测试**：测试多个组件之间的交互
3. **端到端测试**：测试整个扩展的功能
4. **性能测试**：测试扩展在不同条件下的性能表现

### 目录结构

```
src/tests/
  ├── utils/           # 测试工具函数
  ├── mocks/           # 模拟对象
  ├── unit/            # 单元测试
  │   ├── services/    # 服务层测试
  │   └── ui/          # UI组件测试
  ├── integration/     # 集成测试
  ├── e2e/             # 端到端测试
  └── performance/     # 性能测试
```

### 测试技术栈

- **Jest**: 主要测试框架
- **ts-jest**: TypeScript 支持
- **Sinon**: 用于创建 spy, stub 和 mock
- **@vscode/test-electron**: 用于测试 VS Code 扩展

## 运行测试

### 前提条件

确保已安装所有依赖：

```bash
npm install
```

### 运行所有测试

```bash
npm test
```

### 运行单元测试

```bash
npm run test:unit
```

### 运行集成测试

```bash
npm run test:integration
```

### 运行端到端测试

```bash
npm run test:e2e
```

### 运行性能测试

```bash
npm run test:performance
```

### 生成测试覆盖率报告

```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录下。

## 编写测试

### 单元测试示例

```typescript
import { PromptService } from '../../../services/prompt-service';
import * as fs from 'fs';

// 模拟依赖
jest.mock('fs');

describe('PromptService', () => {
  // 测试用例
  test('应该加载提示词', () => {
    // 设置
    // ...
    
    // 执行
    // ...
    
    // 断言
    // ...
  });
});
```

### 模拟 VS Code API

为了测试依赖于 VS Code API 的代码，我们使用了自定义的模拟：

```typescript
// 从模拟模块导入
import * as vscode from '../../mocks/vscode';

// 使用模拟API
vscode.window.showInformationMessage('测试');
```

## 最佳实践

1. **测试隔离**：每个测试应该是独立的，不依赖于其他测试的状态
2. **模拟外部依赖**：测试时应该模拟外部依赖，如文件系统、VS Code API 等
3. **合理使用断言**：使用明确的断言来验证代码的行为
4. **测试边界条件**：测试正常情况和边界条件，包括错误处理
5. **保持测试简单**：每个测试应该专注于测试一个特定的行为或功能

## 持续集成

项目使用 GitHub Actions 进行持续集成，在每次提交时自动运行测试。配置文件位于 `.github/workflows/` 目录下。

## 故障排除

### 常见问题

1. **测试超时**：可能是由于异步操作没有正确完成。检查是否正确使用了 `async/await` 或 Promise。

2. **模拟对象未按预期工作**：确保在每个测试之前重置所有模拟：
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

3. **VS Code API 错误**：确保正确导入和使用了 VS Code API 的模拟。 