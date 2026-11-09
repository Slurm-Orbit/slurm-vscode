const vscode = require('vscode');
const { JobHistoryProvider } = require('./jobHistoryProvider');
const { NodeProvider } = require('./nodeProvider');
const { AccountProvider } = require('./accountProvider');

const VIEWS = {
  jobs: 'slurm-gui.jobs',
  nodes: 'slurm-gui.nodes',
  accounts: 'slurm-gui.accounts',
};

async function runSlurmFile(uri, onSubmitted) {
  const target = uri instanceof vscode.Uri ? uri : vscode.window.activeTextEditor?.document.uri;
  if (!target || target.scheme !== 'file') {
    vscode.window.showErrorMessage('只能运行本地 .slurm 文件');
    return;
  }

  const editor = vscode.window.visibleTextEditors.find(
    (item) => item.document.uri.toString() === target.toString()
  );
  if (editor?.document.isDirty) {
    const saved = await editor.document.save();
    if (!saved) {
      return;
    }
  }

  try {
    const { submitSlurmJob } = await import('slurmjs');
    const jobId = await submitSlurmJob(target.fsPath);
    vscode.window.showInformationMessage(`作业已提交：#${jobId}`);
    onSubmitted?.();
  } catch (error) {
    vscode.window.showErrorMessage(error.message || '作业提交失败');
  }
}

async function cancelRunningJob(element, onCancelled) {
  const job = element?.job || (element?.jobId != null ? element : null);
  if (!job?.jobId) {
    return;
  }

  const jobId = job.jobId;
  const name = job.name ? `「${job.name}」` : '';
  const answer = await vscode.window.showWarningMessage(
    `确定取消作业 #${jobId}${name}？`,
    { modal: true },
    '取消作业'
  );
  if (answer !== '取消作业') {
    return;
  }

  try {
    const { cancelSlurmJob } = await import('slurmjs');
    await cancelSlurmJob(jobId);
    vscode.window.showInformationMessage(`已请求取消作业 #${jobId}`);
    onCancelled?.();
  } catch (error) {
    vscode.window.showErrorMessage(error.message || '取消作业失败');
  }
}

function activate(context) {
  const providers = {
    jobs: new JobHistoryProvider(VIEWS.jobs),
    nodes: new NodeProvider(VIEWS.nodes),
    accounts: new AccountProvider(VIEWS.accounts),
  };
  const allProviders = Object.values(providers);

  context.subscriptions.push(
    ...allProviders,
    vscode.commands.registerCommand('slurm-gui.refresh', () => {
      for (const provider of allProviders) {
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand('slurm-gui.focus', () => {
      return vscode.commands.executeCommand(`${VIEWS.jobs}.focus`);
    }),
    vscode.commands.registerCommand('slurm-gui.run', (uri) => {
      return runSlurmFile(uri, () => providers.jobs.refresh());
    }),
    vscode.commands.registerCommand('slurm-gui.cancelJob', (element) => {
      return cancelRunningJob(element, () => {
        providers.jobs.refresh();
        providers.nodes.refresh();
      });
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
