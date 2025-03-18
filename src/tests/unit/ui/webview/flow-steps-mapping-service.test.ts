import * as fs from 'fs';
import * as path from 'path';
import { FlowStepsMappingService } from '../../../../ui/webview/flow-steps-mapping-service';
import { IFlowStep } from '../../../../interfaces';

// 模拟fs模块
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// 模拟path模块
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/'))
}));

// 模拟utils.ts中的函数
jest.mock('../../../../utils', () => ({
  handleError: jest.fn(),
  log: jest.fn()
}));

describe('FlowStepsMappingService', () => {
  const mockExtensionPath = '/test/extension/path';
  const mockMappingFilePath = '/test/extension/path/data/flow-steps-mapping.json';
  let service: FlowStepsMappingService;
  let mockMappingData: Record<string, { steps: IFlowStep[] }>;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 设置路径模块模拟
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // 设置模拟数据
    mockMappingData = {
      'workflow1': {
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            description: '步骤1描述',
            recommendedRoles: ['role1', 'role2'],
            outputArtifacts: ['文档1']
          },
          {
            id: 'step2',
            name: '步骤2',
            description: '步骤2描述',
            recommendedRoles: ['role3'],
            outputArtifacts: ['文档2']
          }
        ]
      },
      'workflow2': {
        steps: [
          {
            id: 'step3',
            name: '步骤3',
            description: '步骤3描述',
            recommendedRoles: ['role4'],
            outputArtifacts: ['文档3']
          }
        ]
      }
    };
  });
  
  test('初始化时应尝试加载现有映射文件', () => {
    // 模拟文件存在
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockMappingData));
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 验证路径拼接
    expect(path.join).toHaveBeenCalledWith(mockExtensionPath, 'data', 'flow-steps-mapping.json');
    
    // 验证文件读取
    expect(fs.existsSync).toHaveBeenCalledWith(mockMappingFilePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockMappingFilePath, 'utf-8');
    
    // 验证日志记录
    const log = require('../../../../utils').log;
    expect(log).toHaveBeenCalledWith(expect.stringContaining('已加载'));
  });
  
  test('文件不存在时应创建默认映射', () => {
    // 模拟文件不存在
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 验证目录创建
    expect(fs.mkdirSync).toHaveBeenCalled();
    
    // 验证文件写入
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mockMappingFilePath,
      expect.any(String),
      'utf-8'
    );
    
    // 验证写入的内容是否包含默认数据
    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenData = JSON.parse(writeCall[1]);
    expect(writtenData).toHaveProperty('product-development');
    expect(writtenData['product-development']).toHaveProperty('steps');
    expect(writtenData['product-development'].steps.length).toBeGreaterThan(0);
    
    // 验证日志记录
    const log = require('../../../../utils').log;
    expect(log).toHaveBeenCalledWith(expect.stringContaining('已创建默认'));
  });
  
  test('加载时发生错误应创建默认映射', () => {
    // 模拟文件存在但读取时出错
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('模拟读取错误');
    });
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 验证错误处理
    const handleError = require('../../../../utils').handleError;
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining('加载流程步骤映射失败')
    );
    
    // 验证创建默认映射
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
  
  test('getFlowStepsMapping应返回指定工作流的步骤映射', () => {
    // 模拟文件存在
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockMappingData));
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 测试获取存在的工作流
    const steps1 = service.getFlowStepsMapping('workflow1');
    expect(steps1).toEqual(mockMappingData.workflow1.steps);
    
    // 测试获取不存在的工作流
    const steps3 = service.getFlowStepsMapping('workflow3');
    expect(steps3).toEqual([]);
  });
  
  test('getAllFlowStepsMapping应返回所有工作流步骤映射', () => {
    // 模拟文件存在
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockMappingData));
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    const allMappings = service.getAllFlowStepsMapping();
    
    // 验证返回的数据结构与模拟数据相同
    expect(allMappings).toEqual(mockMappingData);
    
    // 验证返回的是副本而非引用
    expect(allMappings).not.toBe(mockMappingData);
  });
  
  test('reload方法应重新加载映射数据', () => {
    // 首次加载
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockMappingData));
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 清除readFileSync的调用记录
    (fs.readFileSync as jest.Mock).mockClear();
    
    // 调用reload
    service.reload();
    
    // 验证再次读取文件
    expect(fs.readFileSync).toHaveBeenCalledWith(mockMappingFilePath, 'utf-8');
  });
  
  test('创建默认映射时发生错误应处理异常', () => {
    // 模拟文件不存在
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // 模拟创建目录时出错
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('模拟创建目录错误');
    });
    
    service = new FlowStepsMappingService(mockExtensionPath);
    
    // 验证错误处理
    const handleError = require('../../../../utils').handleError;
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining('创建默认流程步骤映射失败')
    );
  });
}); 