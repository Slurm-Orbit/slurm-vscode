const vscode = require('vscode');
const { readError } = require('./slurm');

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
  constructor(viewId, options = {}) {
    this.viewId = viewId;
    this._emptyMessage = options.emptyMessage || '暂无数据';
    this._showCollapseAll = Boolean(options.showCollapseAll);
    this._items = [];
    this._loaded = false;
    this._error = '';
    this._pending = null;
    this._generation = 0;

    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    this._view = vscode.window.createTreeView(viewId, {
      treeDataProvider: this,
      showCollapseAll: this._showCollapseAll,
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

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (element) {
      return Array.isArray(element.children) ? element.children : [];
    }
    return this._ensureLoaded();
  }

  async load() {
    return [];
  }

  describe(items) {
    return `${items.length} 项`;
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
          this._items = [];
          this._loaded = true;
          this._error = readError(error);
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
