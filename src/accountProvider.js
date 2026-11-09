const vscode = require('vscode');
const { buildAccountTree, fetchAccounts } = require('./slurm');
const { SlurmTreeProvider } = require('./treeProvider');

class AccountProvider extends SlurmTreeProvider {
  constructor(viewId) {
    super(viewId, { emptyMessage: '暂无账户', showCollapseAll: true });
    this._total = 0;
  }

  async load() {
    const accounts = await fetchAccounts();
    const tree = buildAccountTree(accounts);
    this._total = tree.count;
    return tree.roots;
  }

  describe() {
    return `${this._total} 个账户`;
  }

  getTreeItem(node) {
    const hasChildren = node.children.length > 0;
    const item = new vscode.TreeItem(
      node.name,
      hasChildren
        ? node.depth === 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = `slurm-account-${node.name}`;
    item.description = [node.description, node.flags.join(', ')].filter(Boolean).join(' · ');
    item.iconPath = new vscode.ThemeIcon(hasChildren ? 'organization' : 'account');
    item.contextValue = 'slurmAccount';
    return item;
  }
}

module.exports = { AccountProvider };
