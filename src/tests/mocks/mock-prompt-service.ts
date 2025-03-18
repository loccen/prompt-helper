import { IPromptRole } from '../../interfaces';
import { PromptService } from '../../services';

/**
 * PromptService的模拟实现
 */
export class MockPromptService implements Partial<PromptService> {
  private roles: IPromptRole[] = [];
  public readonly rolesDir: string = '/mock/prompts/roles';
  public readonly categories: Set<string> = new Set();
  public readonly extensionPath: string = '/mock/extension';
  
  /**
   * 创建 PromptService 的模拟实例
   * @param mockRoles 预设的角色列表
   */
  constructor(mockRoles: IPromptRole[] = []) {
    this.roles = mockRoles;
    // 从角色中收集分类
    mockRoles.forEach(role => {
      this.categories.add(role.category);
    });
  }
  
  /**
   * 获取所有角色
   */
  public getRoles(): IPromptRole[] {
    return this.roles;
  }
  
  /**
   * 获取所有分类
   */
  public getCategories(): string[] {
    return [...this.categories];
  }
  
  /**
   * 根据分类获取角色
   * @param category 分类名称
   */
  public getRolesByCategory(category: string): IPromptRole[] {
    return this.roles.filter(role => role.category === category);
  }
  
  /**
   * 根据ID获取角色
   * @param roleId 角色ID
   */
  public getRoleById(roleId: string): IPromptRole | undefined {
    return this.roles.find(r => r.id === roleId);
  }
  
  /**
   * 获取角色提示词内容
   * @param roleId 角色ID
   */
  public async getPromptContent(roleId: string): Promise<string> {
    const role = this.getRoleById(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }
    return `# ${role.name}\n\n## 角色描述\n\n${role.description}\n\n## Mock content for ${role.name}`;
  }
  
  /**
   * 重新加载角色列表
   */
  public reload(): void {
    // 模拟重新加载
  }
  
  /**
   * 加载角色
   */
  public loadRoles(): void {
    // 空实现
  }
  
  /**
   * 注册一个新角色
   * @param role 要添加的角色
   */
  public addRole(role: IPromptRole): void {
    this.roles.push(role);
    this.categories.add(role.category);
  }
  
  /**
   * 清空所有角色
   */
  public clearRoles(): void {
    this.roles = [];
    this.categories.clear();
  }
} 