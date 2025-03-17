import * as fs from 'fs';
import * as path from 'path';
import { IFlowStep } from '../../interfaces';
import { handleError, log } from '../../utils';

/**
 * 流程步骤映射服务
 * 负责加载和管理流程步骤映射数据
 */
export class FlowStepsMappingService {
  // 流程步骤映射数据
  private _flowStepsMapping: Record<string, { steps: IFlowStep[] }> = {};
  
  // 流程步骤与角色映射配置文件路径
  private _mappingFilePath: string;
  
  constructor(extensionPath: string) {
    this._mappingFilePath = path.join(extensionPath, 'data', 'flow-steps-mapping.json');
    this.loadMapping();
  }
  
  /**
   * 获取特定工作流的步骤映射
   * @param flowId 流程ID
   */
  getFlowStepsMapping(flowId: string): IFlowStep[] {
    return this._flowStepsMapping[flowId]?.steps || [];
  }
  
  /**
   * 获取所有流程步骤映射
   */
  getAllFlowStepsMapping(): Record<string, { steps: IFlowStep[] }> {
    return { ...this._flowStepsMapping };
  }
  
  /**
   * 重新加载映射数据
   */
  reload(): void {
    this.loadMapping();
  }
  
  /**
   * 加载流程步骤映射
   */
  private loadMapping(): void {
    try {
      if (fs.existsSync(this._mappingFilePath)) {
        const content = fs.readFileSync(this._mappingFilePath, 'utf-8');
        this._flowStepsMapping = JSON.parse(content);
        log('已加载流程步骤映射数据');
      } else {
        // 创建默认映射
        this.createDefaultMapping();
      }
    } catch (error) {
      handleError(error, '加载流程步骤映射失败');
      // 出错时创建默认映射
      this.createDefaultMapping();
    }
  }
  
  /**
   * 创建默认映射
   */
  private createDefaultMapping(): void {
    try {
      // 创建默认的映射内容
      const defaultMapping: Record<string, { steps: IFlowStep[] }> = {
        'product-development': {
          steps: [
            {
              id: 'requirements',
              name: '需求分析',
              description: '收集并分析产品需求，确定产品目标和范围',
              recommendedRoles: ['1-产品经理角色提示词', '1-用户研究员角色提示词'],
              outputArtifacts: ['需求文档', '用户故事']
            },
            {
              id: 'design',
              name: '设计阶段',
              description: '创建产品的UI/UX设计和架构设计',
              recommendedRoles: ['3-UI设计师角色提示词', '2-系统架构师角色提示词'],
              outputArtifacts: ['设计稿', '架构文档']
            },
            {
              id: 'development',
              name: '开发阶段',
              description: '进行产品的编码和开发工作',
              recommendedRoles: ['5-前端开发工程师角色提示词', '6-后端开发工程师角色提示词'],
              outputArtifacts: ['源代码', '技术文档']
            },
            {
              id: 'testing',
              name: '测试阶段',
              description: '进行产品的测试和质量保证',
              recommendedRoles: ['7-测试工程师角色提示词', '7-质量保障专家角色提示词'],
              outputArtifacts: ['测试报告', '缺陷记录']
            },
            {
              id: 'deployment',
              name: '部署阶段',
              description: '将产品部署到生产环境',
              recommendedRoles: ['8-DevOps工程师角色提示词', '8-发布管理员角色提示词'],
              outputArtifacts: ['部署文档', '运维指南']
            }
          ]
        }
      };

      // 将默认映射保存到文件
      const dirPath = path.dirname(this._mappingFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(
        this._mappingFilePath,
        JSON.stringify(defaultMapping, null, 2),
        'utf-8'
      );
      
      this._flowStepsMapping = defaultMapping;
      log('已创建默认流程步骤映射');
    } catch (error) {
      handleError(error, '创建默认流程步骤映射失败');
    }
  }
} 