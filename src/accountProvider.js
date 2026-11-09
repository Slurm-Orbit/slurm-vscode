const vscode = require('vscode');
const { SlurmTreeProvider } = require('./treeProvider');

class AccountProvider extends SlurmTreeProvider {
  constructor(viewId) {
    super(viewId, '暂无账户');
    this._total = 0;
  }

  async load() {
    const { getSlurmAccountInfo } = await import('slurmjs');
    const accounts = await getSlurmAccountInfo();
    const tree = buildAccountTree(Array.isArray(accounts) ? accounts : []);
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
    return item;
  }
}

function buildAccountTree(accounts) {
  const nodes = new Map();

  for (const account of accounts) {
    const name = account?.name || '';
    if (!name || nodes.has(name)) {
      continue;
    }
    nodes.set(name, {
      name,
      parent: account?.parent || '',
      description: account?.description || '',
      flags: [].concat(account?.flags || []).filter(Boolean),
      children: [],
      depth: 0,
    });
  }

  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parent && node.parent !== node.name ? nodes.get(node.parent) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortLevel = (level, depth) => {
    level.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    for (const node of level) {
      node.depth = depth;
      sortLevel(node.children, depth + 1);
    }
  };
  sortLevel(roots, 0);

  return { roots, count: nodes.size };
}

module.exports = { AccountProvider };
