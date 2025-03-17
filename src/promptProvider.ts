import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PromptTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly id?: string,
    public readonly filePath?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = label;
    if (id) {
      this.id = id;
    }
  }
}

export interface IPromptRole {
  id: string;
  name: string;
  description: string;
  filePath: string;
  category: string;
  sortKey: string;
}

// 角色分类映射
interface ICategoryMapping {
  [prefix: string]: string;
}

export class PromptProvider implements vscode.TreeDataProvider<PromptTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PromptTreeItem | undefined | null> = new vscode.EventEmitter<PromptTreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<PromptTreeItem | undefined | null> = this._onDidChangeTreeData.event;
  
  private roles: IPromptRole[] = [];
  private rolesDir: string;
  private categories: Set<string> = new Set();

  // 根据文件名前缀定义分类
  private categoryMapping: ICategoryMapping = {
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

  constructor(private extensionPath: string) {
    this.rolesDir = path.join(this.extensionPath, 'prompts', 'roles');
    this.loadRoles();
  }

  refresh(): void {
    this.loadRoles();
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: PromptTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
    if (!element) {
      // 根节点，显示所有分类
      return Array.from(this.categories).sort().map(category => 
        new PromptTreeItem(
          category,
          vscode.TreeItemCollapsibleState.Expanded,
          `category-${category}`
        )
      );
    } else if (element.id?.startsWith('category-')) {
      // 分类节点，显示该分类下的所有角色
      const category = element.id.substring('category-'.length);
      return this.roles
        .filter(role => role.category === category)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(role => new PromptTreeItem(
          role.name,
          vscode.TreeItemCollapsibleState.None,
          role.id,
          role.filePath,
          {
            command: 'prompt-helper.insertPrompt',
            title: '插入提示词',
            arguments: [role.id]
          }
        ));
    }
    return [];
  }

  private getCategoryFromFileName(fileName: string): string {
    for (const prefix in this.categoryMapping) {
      if (fileName.startsWith(prefix)) {
        return this.categoryMapping[prefix];
      }
    }
    return '其他';
  }

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
            const category = this.getCategoryFromFileName(file);
            
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
      console.error('加载角色提示词失败:', error);
    }
  }

  async getPromptContent(roleId: string): Promise<string | undefined> {
    const role = this.roles.find(r => r.id === roleId);
    if (role && role.filePath) {
      return fs.readFileSync(role.filePath, 'utf-8');
    }
    return undefined;
  }
} 