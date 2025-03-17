import { ICategoryMapping } from '../interfaces';

/**
 * 角色分类映射配置
 * 根据文件名前缀定义分类
 */
export const categoryMapping: ICategoryMapping = {
  '0-': '通用规范',
  '1-': '产品管理',
  '2-': '系统架构',
  '3-': 'UI设计',
  '4-': '数据库',
  '5-': '客户端开发',
  '6-': '后端开发',
  '7-': '测试',
  '8-': 'DevOps',
  '9-': '工具开发',
  '10-': 'AI专家',
  '11-': '代码质量',
};

/**
 * 根据文件名获取分类
 * @param fileName 文件名
 * @returns 分类名称
 */
export function getCategoryFromFileName(fileName: string): string {
  for (const prefix in categoryMapping) {
    if (fileName.startsWith(prefix)) {
      return categoryMapping[prefix];
    }
  }
  return '其他';
} 