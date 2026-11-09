const path = require('path');
const vscode = require('vscode');
const {
  asText,
  fetchJobHistory,
  formatDateTime,
  formatShortTime,
  jobDate,
} = require('./slurm');
const {
  SlurmTreeProvider,
  createDetail,
  createDetailTreeItem,
} = require('./treeProvider');

const JOB_STATE_ICONS = {
  RUNNING: ['play', 'charts.blue'],
  COMPLETED: ['check', 'charts.green'],
  PENDING: ['watch', 'charts.yellow'],
  CONFIGURING: ['sync', 'charts.yellow'],
  COMPLETING: ['sync', 'charts.blue'],
  REQUEUED: ['debug-restart', 'charts.yellow'],
  PREEMPTED: ['debug-restart', 'charts.orange'],
  SUSPENDED: ['debug-pause', 'charts.yellow'],
  FAILED: ['error', 'charts.red'],
  NODE_FAIL: ['error', 'charts.red'],
  BOOT_FAIL: ['error', 'charts.red'],
  OUT_OF_MEMORY: ['warning', 'charts.red'],
  TIMEOUT: ['clock', 'charts.orange'],
  DEADLINE: ['clock', 'charts.red'],
  CANCELLED: ['circle-slash', 'disabledForeground'],
};

class JobHistoryProvider extends SlurmTreeProvider {
  constructor(viewId) {
    super(viewId, { emptyMessage: '暂无作业历史', showCollapseAll: true });
  }

  async load() {
    const jobs = await fetchJobHistory();
    return jobs.map((job) => ({ job, children: jobDetails(job) }));
  }

  describe(items) {
    return `${items.length} 个作业`;
  }

  getTreeItem(element) {
    if (!element.job) {
      return createDetailTreeItem(element);
    }

    const job = element.job;
    const state = asText(job.status) || '未知';
    const submittedAt = jobDate(job);
    const item = new vscode.TreeItem(
      asText(job.name) || '未命名作业',
      element.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = `slurm-job-${asText(job.jobId)}`;
    item.description = [
      job.jobId == null ? '' : `#${asText(job.jobId)}`,
      state,
      formatShortTime(submittedAt),
    ]
      .filter(Boolean)
      .join(' · ');
    item.iconPath = jobStateIcon(state);
    item.contextValue =
      normalizeJobState(state) === 'RUNNING' ? 'slurmJob.running' : 'slurmJob';
    return item;
  }
}

function normalizeJobState(state) {
  return asText(state).toUpperCase().split(/[+\s]/)[0];
}

function jobStateStyle(state) {
  return JOB_STATE_ICONS[normalizeJobState(state)] || ['circle-outline', undefined];
}

function jobStateIcon(state) {
  const [icon, color] = jobStateStyle(state);
  return new vscode.ThemeIcon(icon, color ? new vscode.ThemeColor(color) : undefined);
}

function jobDetails(job) {
  const state = asText(job.status) || '未知';
  const [stateIcon, stateColor] = jobStateStyle(state);
  const exitCode = asText(job.exitCode);
  const exitOk = Number(job.exitCode) === 0;
  const stdout = asText(job.stdout);
  const stderr = asText(job.stderr);

  return [
    createDetail('状态', state, stateIcon, stateColor),
    createDetail('用户', asText(job.user), 'account'),
    createDetail('账户', asText(job.account), 'organization'),
    createDetail('分区', asText(job.partition), 'list-unordered'),
    createDetail('集群', asText(job.cluster), 'server'),
    createDetail('提交时间', formatDateTime(job.submitTime), 'calendar'),
    createDetail('开始时间', formatDateTime(job.startTime), 'calendar'),
    createDetail('结束时间', formatDateTime(job.endTime), 'calendar'),
    createDetail(
      '退出码',
      exitCode,
      exitOk ? 'pass' : 'error',
      exitOk ? 'charts.green' : 'charts.red'
    ),
    createDetail('工作目录', asText(job.workDir), 'folder'),
    createDetail(
      '标准输出',
      stdout,
      'output',
      undefined,
      openFileCommand(stdout, '打开标准输出')
    ),
    createDetail(
      '标准错误',
      stderr,
      'output',
      undefined,
      openFileCommand(stderr, '打开标准错误')
    ),
  ].filter(Boolean);
}

function openFileCommand(filePath, title) {
  if (!filePath || !path.isAbsolute(filePath)) {
    return undefined;
  }
  return {
    command: 'vscode.open',
    title,
    arguments: [vscode.Uri.file(filePath)],
  };
}

module.exports = { JobHistoryProvider };
