# Prompt-Helper 代码重构说明

## 重构概述

本次重构的主要目标是提高代码的可维护性、可测试性和可扩展性。通过采用分层架构和组件化设计，将原有紧耦合的代码拆分为更小、更专注的模块，同时统一了接口定义和错误处理机制。

## 项目结构

重构后的项目结构如下：

```
src/
├── config/               # 配置相关模块
│   ├── categories.ts     # 角色分类配置
│   └── index.ts          # 配置模块入口
├── interfaces.ts         # 共用接口定义
├── services/             # 服务层，负责数据访问和处理
│   ├── prompt-service.ts # 提示词服务
│   ├── workflow-service.ts # 工作流服务
│   └── index.ts          # 服务模块入口
├── ui/                   # UI层，负责界面展示
│   ├── tree-view/        # 树视图组件
│   │   ├── prompt-tree-provider.ts  # 提示词树视图提供者
│   │   ├── workflow-tree-provider.ts # 工作流树视图提供者
│   │   └── index.ts      # 树视图模块入口
│   ├── webview/          # WebView组件
│   │   ├── dev-flow-guide-provider.ts # 开发流程引导器
│   │   ├── dev-flow-html-generator.ts # HTML生成器
│   │   ├── flow-state-manager.ts     # 流程状态管理器
│   │   ├── flow-steps-mapping-service.ts # 步骤映射服务
│   │   └── index.ts      # WebView模块入口
│   └── index.ts          # UI模块入口
├── tests/                # 测试模块
│   └── flow-state-manager.test.ts # 流程状态管理器测试
├── utils.ts              # 共用工具函数
├── extension.ts          # 插件入口点
└── README.md             # 项目说明文档
```

## 主要变化

### 1. 分层架构

- **接口层**：统一定义了各组件间的通信接口
- **服务层**：负责数据访问和核心业务逻辑
- **UI层**：负责界面展示和用户交互
- **工具层**：提供通用功能和工具函数

### 2. 组件化设计

- 将大型类（如DevFlowGuideProvider）拆分为多个专注的小型组件
- 每个组件只关注自己的职责，提高了可维护性

### 3. 模块化组织

- 按功能划分模块，每个模块只导出必要的接口
- 使用index.ts作为模块入口，简化导入路径

### 4. 改进的错误处理

- 统一的错误处理机制
- 更详细的日志记录

### 5. 可测试性提升

- 通过依赖注入模式使组件易于测试
- 添加了单元测试示例

## 主要组件说明

### 服务层组件

1. **PromptService**
   - 负责加载和管理角色提示词数据
   - 提供按分类查询和获取提示词内容的接口

2. **WorkflowService**
   - 负责加载和管理工作流数据
   - 提供获取工作流信息的接口

### UI层组件

1. **PromptTreeProvider**
   - 提供角色提示词的树视图数据
   - 依赖PromptService获取数据

2. **WorkflowTreeProvider**
   - 提供工作流的树视图数据
   - 依赖WorkflowService和PromptService

3. **DevFlowGuideProvider**
   - 项目开发流程引导器的主控制器
   - 协调其他WebView组件的工作

4. **FlowStateManager**
   - 管理流程状态和持久化
   - 提供状态操作接口

5. **FlowStepsMappingService**
   - 管理流程步骤映射数据
   - 提供根据流程ID获取步骤映射的接口

6. **DevFlowHtmlGenerator**
   - 生成WebView所需的HTML内容
   - 分离UI表现逻辑和业务逻辑

## 升级建议

- 继续完善测试覆盖率
- 考虑添加依赖注入容器简化组件创建
- 持续监控性能，确保重构不影响用户体验 