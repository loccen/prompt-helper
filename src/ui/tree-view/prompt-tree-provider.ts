import * as vscode from 'vscode';
import { BaseTreeItem } from '../../interfaces';
import { PromptService } from '../../services';

/**
 * 提示词树项
 */
export class PromptTreeItem extends BaseTreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly id?: string,
    public readonly filePath?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState, id, command);
  }
}

/**
 * 提示词树视图提供者
 * 负责提供角色提示词的树视图数据
 */
export class PromptTreeProvider implements vscode.TreeDataProvider<PromptTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PromptTreeItem | undefined | null> = new vscode.EventEmitter<PromptTreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<PromptTreeItem | undefined | null> = this._onDidChangeTreeData.event;
  
  constructor(private promptService: PromptService) {}

  /**
   * 刷新树视图
   */
  refresh(): void {
    this.promptService.reload();
    this._onDidChangeTreeData.fire(null);
  }

  /**
   * 获取树项
   */
  getTreeItem(element: PromptTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子项
   */
  async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
    if (!element) {
      // 根节点，显示所有分类
      return this.promptService.getCategories().map(category => 
        new PromptTreeItem(
          category,
          vscode.TreeItemCollapsibleState.Expanded,
          `category-${category}`
        )
      );
    } else if (element.id?.startsWith('category-')) {
      // 分类节点，显示该分类下的所有角色
      const category = element.id.substring('category-'.length);
      return this.promptService.getRolesByCategory(category)
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

  /**
   * 获取提示词内容
   */
  async getPromptContent(roleId: string): Promise<string | undefined> {
    return this.promptService.getPromptContent(roleId);
  }
} 