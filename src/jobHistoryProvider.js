const dayjs = require('dayjs');
const path = require('path');
const vscode = require('vscode');
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
    super(viewId, '暂无作业历史');
  }

  async load() {
    const { getSlurmJobInfo } = await import('slurmjs');
    const jobs = await getSlurmJobInfo();
    const items = Array.isArray(jobs) ? jobs : [];
    const time = (job) => (job?.submitTime || job?.startTime || job?.endTime)?.getTime() || 0;
    items.sort((a, b) => time(b) - time(a) || Number(b?.jobId ?? 0) - Number(a?.jobId ?? 0));
    return items.map((job) => ({ job, children: jobDetails(job) }));
  }

  describe(items) {
    return `${items.length} 个作业`;
  }

  getTreeItem(element) {
    if (!element.job) {
      return createDetailTreeItem(element);
    }

    const job = element.job;
    const state = (Array.isArray(job.status) ? job.status.join('+') : job.status) || '未知';
    const stateKey = String(state).toUpperCase().split(/[+\s]/)[0];
    const [icon, color] = JOB_STATE_ICONS[stateKey] || ['circle-outline', undefined];
    const submittedAt = job.submitTime || job.startTime || job.endTime || null;
    const item = new vscode.TreeItem(
      job.name || '未命名作业',
      element.children.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = `slurm-job-${job.jobId}`;
    item.description = [
      job.jobId == null ? '' : `#${job.jobId}`,
      state,
      submittedAt ? dayjs(submittedAt).format('MM-DD HH:mm') : '',
    ]
      .filter(Boolean)
      .join(' · ');
    item.iconPath = new vscode.ThemeIcon(
      icon,
      color ? new vscode.ThemeColor(color) : undefined
    );
    if (stateKey === 'RUNNING') {
      item.contextValue = 'slurmJob.running';
    }
    return item;
  }
}

function jobDetails(job) {
  const exitCode = job.exitCode;
  const exitOk = Number(job.exitCode) === 0;
  const stdout = job.stdout || '';
  const stderr = job.stderr || '';
  const timeText = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '');

  return [
    createDetail('用户', job.user, 'account'),
    createDetail('账户', job.account, 'organization'),
    createDetail('分区', job.partition, 'list-unordered'),
    createDetail('集群', job.cluster, 'server'),
    createDetail('提交时间', timeText(job.submitTime), 'calendar'),
    createDetail('开始时间', timeText(job.startTime), 'calendar'),
    createDetail('结束时间', timeText(job.endTime), 'calendar'),
    createDetail(
      '退出码',
      exitCode,
      exitOk ? 'pass' : 'error',
      exitOk ? 'charts.green' : 'charts.red'
    ),
    createDetail('工作目录', job.workDir, 'folder'),
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
