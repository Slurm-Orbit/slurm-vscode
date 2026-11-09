const vscode = require('vscode');

function createDetail(label, value, icon, color, command) {
  const text = value == null ? '' : String(value);
  if (!text) {
    return null;
  }
  return { label, value: text, icon, color, command };
}

function createDetailTreeItem(detail) {
  const item = new vscode.TreeItem(detail.label, vscode.TreeItemCollapsibleState.None);
  item.description = detail.value;
  if (detail.icon) {
    item.iconPath = new vscode.ThemeIcon(
      detail.icon,
      detail.color ? new vscode.ThemeColor(detail.color) : undefined
    );
  }
  if (detail.command) {
    item.command = detail.command;
    item.tooltip = `点击打开文件：${detail.value}`;
  } else {
    item.tooltip = `${detail.label}：${detail.value}`;
  }
  return item;
}

class SlurmTreeProvider {
  constructor(viewId, emptyMessage) {
    this._emptyMessage = emptyMessage;
    this._items = [];
    this._loaded = false;
    this._error = '';
    this._pending = null;
    this._generation = 0;

    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    this._view = vscode.window.createTreeView(viewId, {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    this._view.message = '读取中…';
  }

  dispose() {
    this._view.dispose();
    this._onDidChangeTreeData.dispose();
  }

  refresh() {
    this._generation += 1;
    this._pending = null;
    this._loaded = false;
    this._items = [];
    this._error = '';
    this._view.description = undefined;
    this._view.message = '读取中…';
    this._onDidChangeTreeData.fire();
  }

  getChildren(element) {
    if (element) {
      return Array.isArray(element.children) ? element.children : [];
    }
    return this._ensureLoaded();
  }

  async _ensureLoaded() {
    if (this._loaded) {
      return this._items;
    }
    if (!this._pending) {
      const generation = this._generation;
      this._pending = this.load().then(
        (items) => {
          if (generation !== this._generation) {
            return this._items;
          }
          this._items = Array.isArray(items) ? items : [];
          this._loaded = true;
          this._error = '';
          this._updateView();
          return this._items;
        },
        (error) => {
          if (generation !== this._generation) {
            return this._items;
          }
          const message = error?.message || String(error || '读取失败');
          this._items = [];
          this._loaded = true;
          this._error = /not found|ENOENT/i.test(message)
            ? '未找到 Slurm 命令，请确认本机已安装 Slurm 并加入 PATH。'
            : /json|unexpected|parse/i.test(message)
              ? '无法解析 Slurm 命令输出，请确认 Slurm 版本支持 --json。'
              : message;
          this._updateView();
          return this._items;
        }
      );
    }
    return this._pending;
  }

  _updateView() {
    this._view.description =
      !this._error && this._items.length ? this.describe(this._items) : undefined;
    this._view.message =
      this._error || (this._items.length ? undefined : this._emptyMessage);
  }
}

module.exports = { SlurmTreeProvider, createDetail, createDetailTreeItem };
