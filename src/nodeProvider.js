const dayjs = require('dayjs');
const vscode = require('vscode');
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
    super(viewId, '暂无节点');
  }

  async load() {
    const { getSlurmNodeInfo } = await import('slurmjs');
    const nodes = await getSlurmNodeInfo();
    return (Array.isArray(nodes) ? nodes : [])
      .sort((a, b) =>
        (a?.name || '').localeCompare(b?.name || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      )
      .map((node) => ({ node, children: nodeDetails(node) }));
  }

  describe(items) {
    return `${items.length} 个节点`;
  }

  getTreeItem(element) {
    if (!element.node) {
      return createDetailTreeItem(element);
    }

    const node = element.node;
    const name = node.name || node.hostname || '未命名节点';
    const states = [].concat(node.state || [])
      .flatMap((state) => String(state).toUpperCase().split('+'))
      .filter(Boolean);
    const state = states.join('+') || 'UNKNOWN';
    const stateKey = STATE_PRIORITY.find((candidate) => states.includes(candidate)) || state;
    const [icon, color] = NODE_STATE_STYLES[stateKey] || ['vm', undefined];
    const item = new vscode.TreeItem(
      name,
      element.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = `slurm-node-${name}`;
    item.description = [
      [].concat(node.partitions || []).join(', '),
      state,
      cpuText(node),
    ]
      .filter(Boolean)
      .join(' · ');
    item.iconPath = new vscode.ThemeIcon(
      icon,
      color ? new vscode.ThemeColor(color) : undefined
    );
    return item;
  }
}

function cpuText(node) {
  const total = numberOrNull(node.cpus);
  if (total == null || total <= 0) {
    return '';
  }
  return `${numberOrNull(node.allocCpus) ?? 0}/${total} CPU`;
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMemory(megabytes) {
  const value = Number(megabytes);
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} TB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} GB`;
  }
  return `${Math.round(value)} MB`;
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
  const name = node.name || node.hostname;
  const hostname = node.hostname;
  const address = node.address;

  return [
    createDetail('分区', [].concat(node.partitions || []).join(', '), 'list-unordered'),
    createDetail('CPU', cpuSummary(node), 'pulse'),
    createDetail('内存', memorySummary(node), 'database'),
    createDetail('临时磁盘', formatMemory(node.disk), 'save'),
    createDetail('GRES', node.gres, 'device-desktop'),
    createDetail('GRES 已用', node.gresUsed, 'device-desktop'),
    createDetail('架构', node.architecture, 'symbol-structure'),
    createDetail('系统', node.os, 'terminal'),
    createDetail('地址', address && address !== name ? address : '', 'globe'),
    createDetail('主机名', hostname && hostname !== name ? hostname : '', 'server'),
    createDetail(
      '启动时间',
      node.bootTime ? dayjs(node.bootTime).format('YYYY-MM-DD HH:mm') : '',
      'calendar'
    ),
  ].filter(Boolean);
}

module.exports = { NodeProvider };
