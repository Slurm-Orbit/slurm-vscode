# Slurm GUI

在 VS Code 活动栏中查看 Slurm 集群的作业历史、节点和账户。

## 功能

| 视图 | 内容 |
| --- | --- |
| 作业历史 | 当前用户作业，按提交时间倒序；展开查看用户、账户、分区、时间、退出码和输出路径；运行中作业可在行内取消 |
| 节点 | 全部节点，按名称排序；展开查看 CPU、内存、磁盘、GRES、架构、系统等信息 |
| 账户 | 按父子关系组织的账户树，显示描述和标志 |

点击作业展开项中的「标准输出」「标准错误」可在编辑器中打开对应文件。

所有数据均来自 `slurmjs` 调用的 Slurm 命令（`sacct`、`scontrol`、`sacctmgr`），不使用本机系统信息。界面基于 VS Code 原生 TreeView。

## 环境要求

- VS Code 1.120+
- 本机已安装 Slurm，`sacct`、`scontrol`、`sacctmgr` 在 `PATH` 中，且支持 `--json`
- Node.js 18+（仅开发）

## 运行

```bash
npm install
```

按 F5 选择 **Run Extension**。

## 命令

| 命令 | 说明 |
| --- | --- |
| Slurm: 刷新 | 重新读取三个视图 |
| Slurm: 打开侧边栏 | 聚焦「作业历史」视图 |
| Slurm: 运行 | 提交当前 `.slurm` 文件 |

每个视图标题栏右侧也有刷新按钮。

## 目录

| 路径 | 作用 |
| --- | --- |
| `package.json` | 活动栏、视图与命令声明 |
| `src/extension.js` | 激活入口 |
| `src/treeProvider.js` | TreeView 基类：加载、刷新、错误与空状态 |
| `src/jobHistoryProvider.js` | 作业历史视图（`sacct`） |
| `src/nodeProvider.js` | 节点视图（`scontrol`） |
| `src/accountProvider.js` | 账户树视图（`sacctmgr`） |
| `media/icon.svg` | 活动栏图标 |

## 说明

- 作业历史使用 `sacct`，默认仅显示当前用户今日记录。
- 节点和账户信息分别来自 `scontrol show node --json` 与 `sacctmgr list account/assoc --json`。
- 输出文件路径需可从扩展主机访问。
- 账户树按 `parent` 构建；父账户缺失的账户作为顶层账户显示。
- 读取失败时视图会显示原因，可点击标题栏刷新重试。
