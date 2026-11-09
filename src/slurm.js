let slurmModulePromise;

function loadSlurm() {
  if (!slurmModulePromise) {
    slurmModulePromise = import('slurmjs');
  }
  return slurmModulePromise;
}

async function fetchJobHistory() {
  const { getSlurmJobInfo } = await loadSlurm();
  const jobs = await getSlurmJobInfo();
  return (Array.isArray(jobs) ? jobs : []).slice().sort(compareJobs);
}

async function fetchNodes() {
  const { getSlurmNodeInfo } = await loadSlurm();
  const nodes = await getSlurmNodeInfo();
  return (Array.isArray(nodes) ? nodes : []).slice().sort((a, b) =>
    compareNames(a?.name, b?.name)
  );
}

async function fetchAccounts() {
  const { getSlurmAccountInfo } = await loadSlurm();
  const accounts = await getSlurmAccountInfo();
  return Array.isArray(accounts) ? accounts : [];
}

function compareJobs(a, b) {
  const delta = jobTimestamp(b) - jobTimestamp(a);
  if (delta !== 0) {
    return delta;
  }
  return Number(b?.jobId ?? 0) - Number(a?.jobId ?? 0);
}

function jobTimestamp(job) {
  for (const value of [job?.submitTime, job?.startTime, job?.endTime]) {
    const date = toDate(value);
    if (date) {
      return date.getTime();
    }
  }
  return 0;
}

function jobDate(job) {
  for (const value of [job?.submitTime, job?.startTime, job?.endTime]) {
    const date = toDate(value);
    if (date) {
      return date;
    }
  }
  return null;
}

function toDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  if (typeof value === 'object' && value.set !== false && Number.isFinite(value.number)) {
    return new Date(value.number * 1000);
  }
  return null;
}

function compareNames(a, b) {
  return asText(a).localeCompare(asText(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function asArray(value) {
  if (value == null || value === '') {
    return [];
  }
  return Array.isArray(value) ? value.filter((item) => item != null && item !== '') : [value];
}

function asText(value) {
  if (value == null || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join('+');
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatDateTime(value);
  }
  if (typeof value === 'object') {
    return '';
  }
  return String(value);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatShortTime(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
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

function buildAccountTree(accounts) {
  const nodes = new Map();

  for (const account of accounts) {
    const name = asText(account?.name);
    if (!name || nodes.has(name)) {
      continue;
    }
    nodes.set(name, {
      name,
      parent: asText(account?.parent),
      description: asText(account?.description),
      flags: asArray(account?.flags).map(asText).filter(Boolean),
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

  const visited = new Set();
  const visit = (node, depth) => {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    node.depth = depth;
    node.children.sort(compareAccountNodes);
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  };

  roots.sort(compareAccountNodes);
  for (const root of roots) {
    visit(root, 0);
  }

  // 如果账户数据里存在环，把无法从根到达的账户提升为根，避免整棵树丢失。
  for (const node of nodes.values()) {
    if (!visited.has(node)) {
      roots.push(node);
      visit(node, 0);
    }
  }
  roots.sort(compareAccountNodes);

  return { roots, count: nodes.size };
}

function compareAccountNodes(a, b) {
  return compareNames(a.name, b.name);
}

function readError(error) {
  const message = error?.message || String(error || '读取失败');
  if (/not found|ENOENT/i.test(message)) {
    return '未找到 Slurm 命令，请确认本机已安装 Slurm 并加入 PATH。';
  }
  if (/json|unexpected|parse/i.test(message)) {
    return '无法解析 Slurm 命令输出，请确认 Slurm 版本支持 --json。';
  }
  return message;
}

module.exports = {
  asArray,
  asText,
  buildAccountTree,
  fetchAccounts,
  fetchJobHistory,
  fetchNodes,
  formatDateTime,
  formatMemory,
  formatShortTime,
  jobDate,
  readError,
};
