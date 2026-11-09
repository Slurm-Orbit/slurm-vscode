const vscode = require('vscode');
const {
  asArray,
  asText,
  fetchNodes,
  formatDateTime,
  formatMemory,
} = require('./slurm');
const {
  SlurmTreeProvider,
  createDetail,
  createDetailTreeItem,
} = require('./treeProvider');

const NODE_STATE_STYLES = {
  IDLE: ['vm-active', 'charts.green'],
  MIXED: ['vm-running', 'charts.blue'],
  ALLOCATED: ['vm-running', 'charts.blue'],
  COMPLETING: ['sync', 'charts.blue'],
  RESERVED: ['lock', 'charts.purple'],
  DRAIN: ['vm-outline', 'charts.orange'],
  DRAINING: ['vm-outline', 'charts.orange'],
  MAINT: ['tools', 'charts.orange'],
  DOWN: ['vm-outline', 'charts.red'],
  FAIL: ['vm-outline', 'charts.red'],
  FAILING: ['vm-outline', 'charts.red'],
  UNKNOWN: ['question', 'charts.yellow'],
  PLANNED: ['calendar', 'charts.yellow'],
  POWERED_DOWN: ['vm-outline', 'disabledForeground'],
  POWERING_UP: ['vm-outline', 'charts.yellow'],
};

const STATE_PRIORITY = [
  'DOWN',
  'FAIL',
  'FAILING',
  'DRAIN',
  'DRAINING',
  'MAINT',
  'UNKNOWN',
  'MIXED',
  'ALLOCATED',
  'COMPLETING',
  'RESERVED',
  'IDLE',
  'PLANNED',
  'POWERED_DOWN',
  'POWERING_UP',
];

class NodeProvider extends SlurmTreeProvider {
  constructor(viewId) {
    super(viewId, { emptyMessage: '暂无节点', showCollapseAll: true });
  }

  async load() {
    const nodes = await fetchNodes();
    return nodes.map((node) => ({ node, children: nodeDetails(node) }));
  }

  describe(items) {
    return `${items.length} 个节点`;
  }

  getTreeItem(element) {
    if (!element.node) {
      return createDetailTreeItem(element);
    }

    const node = element.node;
    const name = asText(node.name) || asText(node.hostname) || '未命名节点';
    const state = asText(node.state) || 'UNKNOWN';
    const item = new vscode.TreeItem(
      name,
      element.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = `slurm-node-${name}`;
    item.description = [
      asArray(node.partitions).map(asText).join(', '),
      state,
      cpuText(node),
    ]
      .filter(Boolean)
      .join(' · ');
    item.iconPath = nodeStateIcon(node);
    item.contextValue = 'slurmNode';
    return item;
  }
}

function cpuText(node) {
  const total = Number(node.cpus);
  if (!Number.isFinite(total) || total <= 0) {
    return '';
  }
  const allocated = Number(node.allocCpus);
  return `${Number.isFinite(allocated) ? allocated : 0}/${total} CPU`;
}

function nodeStateStyle(node) {
  const states = asArray(node.state)
    .flatMap((state) => asText(state).toUpperCase().split('+'))
    .filter(Boolean);
  const key = STATE_PRIORITY.find((state) => states.includes(state)) || states[0] || 'UNKNOWN';
  return NODE_STATE_STYLES[key] || ['vm', undefined];
}

function nodeStateIcon(node) {
  const [icon, color] = nodeStateStyle(node);
  return new vscode.ThemeIcon(icon, color ? new vscode.ThemeColor(color) : undefined);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cpuSummary(node) {
  const allocated = numberOrNull(node.allocCpus);
  const total = numberOrNull(node.cpus);
  const idle = numberOrNull(node.idleCpus);
  return [
    allocated == null ? '' : `已分配 ${allocated}`,
    total == null ? '' : `共 ${total}`,
    idle == null ? '' : `空闲 ${idle}`,
  ]
    .filter(Boolean)
    .join(' / ');
}

function memorySummary(node) {
  const allocated = numberOrNull(node.allocMemory);
  const total = numberOrNull(node.realMemory);
  const free = numberOrNull(node.freeMem);
  return [
    allocated == null ? '' : `已分配 ${formatMemory(allocated) || '0'}`,
    total == null ? '' : `共 ${formatMemory(total) || '0'}`,
    free == null ? '' : `空闲 ${formatMemory(free) || '0'}`,
  ]
    .filter(Boolean)
    .join(' / ');
}

function nodeDetails(node) {
  const name = asText(node.name) || asText(node.hostname);
  const state = asText(node.state) || 'UNKNOWN';
  const [stateIcon, stateColor] = nodeStateStyle(node);
  const hostname = asText(node.hostname);
  const address = asText(node.address);
  const load = numberOrNull(node.cpuLoad);

  return [
    createDetail('状态', state, stateIcon, stateColor),
    createDetail('分区', asArray(node.partitions).map(asText).join(', '), 'list-unordered'),
    createDetail('CPU', cpuSummary(node), 'pulse'),
    createDetail('CPU 负载', load == null ? '' : `${load}%`, 'graph'),
    createDetail('内存', memorySummary(node), 'database'),
    createDetail('临时磁盘', formatMemory(node.disk), 'save'),
    createDetail('GRES', asText(node.gres), 'device-desktop'),
    createDetail('GRES 已用', asText(node.gresUsed), 'device-desktop'),
    createDetail('架构', asText(node.architecture), 'symbol-structure'),
    createDetail('系统', asText(node.os), 'terminal'),
    createDetail('地址', address && address !== name ? address : '', 'globe'),
    createDetail('主机名', hostname && hostname !== name ? hostname : '', 'server'),
    createDetail('启动时间', formatDateTime(node.bootTime), 'calendar'),
  ].filter(Boolean);
}

module.exports = { NodeProvider };
