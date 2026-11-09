# Slurm GUI

在 VS Code 活动栏的 **Slurm** 侧边栏中查看集群状态。侧边栏保留三栏（三个可折叠的原生视图）布局：

| 视图 | 数据来源 | 内容 |
| --- | --- | --- |
| 作业历史 | `sacct --json` | 当前用户的会计作业记录，按提交时间从新到旧排序；展开可查看用户、账户、分区、时间、退出码和输出路径 |
| 节点 | `scontrol show node --json` | 集群中的全部节点；展开可查看 CPU、内存、GRES、系统等资源 |
| 账户 | `sacctmgr list account --json` + `list assoc --json` | 按父子关系组织的账户树 |

所有视图均使用 VS Code 原生 TreeView：原生图标与主题色、可展开的详情子项、视图标题栏刷新按钮，不再加载 Webview。

> 视图中的信息全部来自 `slurmjs` 调用的 Slurm 命令（`sacct`、`scontrol`、`sacctmgr`），不读取本机 CPU、内存等本地系统信息。

## 环境要求

- VS Code 1.120+
- 本机已安装 Slurm，`sacct`、`scontrol`、`sacctmgr` 在 `PATH` 中，且版本支持 `--json`
- Node.js 18+（开发调试）

## 调试

1. 在本目录执行 `npm install`。
2. 按 F5 选择 **Run Extension**（调试模式）；如果不需要断点，建议直接使用 **Ctrl+F5（Run Without Debugging）**。
3. 在活动栏点击 **Slurm** 图标，即可看到「作业历史」「节点」「账户」三个视图。

无需额外构建步骤。

> **视图一直显示「读取中…」？**
>
> 这通常不是扩展在读取数据，而是 Extension Development Host 以 `--inspect-brk` 启动后调试器没有连上，扩展的 `activate()` 根本没有执行。此时请：
>
> - 关闭该开发宿主窗口，改用 **Ctrl+F5（Run Without Debugging）** 重新启动；
> - 或在命令面板执行 **Developer: Install Extension from Location...**，选择本目录后重新加载窗口；
> - 在 Cursor Remote / VS Code Remote 中尤其容易出现调试器无法附加的问题。
>
> 正常启动后，视图会显示数据或明确的错误信息，不会无限加载。

## 命令

| 命令 | 说明 |
| --- | --- |
| Slurm: 刷新 | 重新读取三个视图 |
| Slurm: 打开侧边栏 | 聚焦「作业历史」视图 |
| Slurm: 运行 | 提交当前 `.slurm` 文件 |
| Slurm: 取消作业 | 取消作业历史中运行中的作业（行内停止按钮或右键菜单） |

每个视图标题栏右侧也有刷新按钮。

## 目录

| 路径 | 作用 |
| --- | --- |
| `package.json` | 活动栏容器、三个树视图、命令 |
| `src/extension.js` | 激活入口，注册视图提供者与命令 |
| `src/treeProvider.js` | 原生 TreeView 基类：加载状态、错误提示、刷新 |
| `src/slurm.js` | slurmjs 数据读取、时间排序、账户树构建与格式化 |
| `src/jobHistoryProvider.js` | 作业历史视图 |
| `src/nodeProvider.js` | 节点视图 |
| `src/accountProvider.js` | 账户树视图 |
| `media/icon.svg` | 活动栏图标 |

## 说明

- 作业历史使用 `sacct`（默认当前用户、今日记录），按提交时间从新到旧排序。
- 点击作业展开项中的「标准输出」「标准错误」可直接在编辑器中打开对应文件；文件路径需可从扩展主机访问。
- 运行中的作业行会显示取消按钮，点击并确认后调用 `scancel`。
- 账户树根据 `parent` 关系构建；无法从根到达的账户会作为顶层账户显示，避免数据成环时丢失账户。
- 读取失败时视图会显示错误原因，可在视图标题栏点击刷新重试。
