import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IPromptRole } from '../interfaces';
import { getCategoryFromFileName } from '../config';
import { log, handleError } from '../utils';

/**
 * 提示词服务类
 * 负责加载和管理提示词数据
 */
export class PromptService {
  private roles: IPromptRole[] = [];
  private rolesDir: string;
  private categories: Set<string> = new Set();

  constructor(private extensionPath: string) {
    this.rolesDir = path.join(this.extensionPath, 'prompts', 'roles');
    this.loadRoles();
  }

  /**
   * 获取所有角色提示词
   */
  getRoles(): IPromptRole[] {
    return this.roles;
  }

  /**
   * 获取所有分类
   */
  getCategories(): string[] {
    return Array.from(this.categories).sort();
  }

  /**
   * 通过ID获取特定角色提示词
   * @param roleId 角色ID
   */
  getRoleById(roleId: string): IPromptRole | undefined {
    return this.roles.find(role => role.id === roleId);
  }

  /**
   * 通过分类获取角色列表
   * @param category 分类名称
   */
  getRolesByCategory(category: string): IPromptRole[] {
    return this.roles
      .filter(role => role.category === category)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  /**
   * 获取提示词内容
   * @param roleId 角色ID
   */
  async getPromptContent(roleId: string): Promise<string | undefined> {
    try {
      const role = this.getRoleById(roleId);
      if (role && role.filePath) {
        return fs.readFileSync(role.filePath, 'utf-8');
      }
      return undefined;
    } catch (error) {
      handleError(error, `获取提示词内容失败(${roleId})`);
      return undefined;
    }
  }

  /**
   * 重新加载角色提示词
   */
  reload(): void {
    this.loadRoles();
  }

  /**
   * 加载所有角色提示词
   */
  private loadRoles() {
    try {
      this.roles = [];
      this.categories.clear();
      
      if (fs.existsSync(this.rolesDir)) {
        const files = fs.readdirSync(this.rolesDir).filter(file => file.endsWith('.md'));
        
        for (const file of files) {
          const filePath = path.join(this.rolesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const titleMatch = content.match(/^# (.+)/m);
          const descriptionMatch = content.match(/## 角色描述\s*\n\s*(.+)/m);
          
          if (titleMatch) {
            const id = path.basename(file, '.md');
            const name = titleMatch[1].replace('角色提示词', '').trim();
            const description = descriptionMatch ? descriptionMatch[1].trim() : '';
            const category = getCategoryFromFileName(file);
            
            this.roles.push({
              id,
              name,
              description,
              filePath,
              category,
              sortKey: file // 使用文件名作为排序键
            });
            
            this.categories.add(category);
          }
        }
      }
    } catch (error) {
      handleError(error, '加载角色提示词失败');
    }
  }
} 