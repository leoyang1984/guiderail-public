# GuideRail

GuideRail 是一个本地优先的 Chrome 侧边栏扩展，用来收藏、阅读和找回 ChatGPT 长回复，并将收藏导出为适合 Obsidian 的 Markdown 笔记。

它解决一个简单问题：有价值的回复经常埋在长对话里。看到值得保留的内容时点一下收藏，之后可以在侧栏阅读、定位回原对话，或导出到自己的 Obsidian 仓库。

## 功能

- 在 ChatGPT 回复末尾一键收藏，不需要建立项目或整理任务。
- 按当前对话或全部收藏浏览，支持修改标题和批量管理。
- 阅读保存的完整正文，并定位回 ChatGPT 中的原回复。
- 在新标签页打开宽版阅读页面。
- 导出单条、所选或当前列表到 Obsidian 文件夹。
- 导出的 Markdown 包含 YAML 属性：标题、来源链接、对话 ID、消息 ID、时间和标签。
- JSON 完整备份与恢复。
- 自动跟随系统明暗模式。

所有收藏保存在当前 Chrome 配置的本地存储中。GuideRail 没有账号、后端或云同步，也不调用 AI API。

## 使用

1. 打开一个 `https://chatgpt.com/c/<conversation-id>` 对话。
2. 在需要保留的回复末尾点击「☆ 收藏这条回复」。
3. 点击 Chrome 工具栏中的 GuideRail，打开侧边栏。
4. 在收藏列表中阅读内容，或点击「定位到原回复」。
5. 如需宽版阅读，打开一条收藏后点击「在新标签页阅读」。

更新扩展后，已经打开的 ChatGPT 标签页需要刷新一次，让新的内容脚本生效。正常切换对话无需刷新。

## 导出到 Obsidian

展开「导出到 Obsidian」，选择 Obsidian 仓库中的目标文件夹，然后导出当前收藏、所选收藏或当前列表。

每条收藏保存为 `GuideRail-<收藏ID>.md`。已有同名文件会跳过，避免覆盖你在 Obsidian 中做过的修改。Chrome 只显示所选文件夹名称，不提供完整绝对路径；目录授权由浏览器管理。

详细格式和验收步骤见 [Obsidian 导出说明](docs/OBSIDIAN_EXPORT.md)。

## 安装

使用发布包时，解压 `GuideRail-<版本>-chrome-<时间>.zip`，在 Chrome 的 `chrome://extensions` 中启用开发者模式并加载解压后的文件夹。以下是从源码构建的方式。

需要 Node.js 22.12 或更高版本以及 npm。

```sh
npm ci
npm run build
```

然后在 Chrome 中安装本地构建：

1. 打开 `chrome://extensions`。
2. 启用「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本项目的 `dist` 文件夹。
5. 将 GuideRail 固定到 Chrome 工具栏。

修改代码后重新运行 `npm run build`，再到扩展管理页点击 GuideRail 的重新加载按钮，并刷新已打开的 ChatGPT 页面。

## 开发

```sh
npm ci
npm test
npm run build
```

- `npm test`：运行领域逻辑、存储、定位和导出测试。
- `npm run build`：执行 TypeScript 检查、Vite 生产构建和扩展入口校验。
- `npm run dev`：启动界面开发预览；普通网页无法完整模拟 Chrome 扩展 API。

真实的收藏、标签页切换、目录授权和 Obsidian 展示仍需在 Chrome 中验收。

## 项目结构

```text
public/manifest.json       Chrome Manifest V3 配置
src/background/            后台消息处理和串行保存
src/content/               ChatGPT 回复收藏与原文定位
src/export/                Obsidian Markdown 和目录写入
src/sidepanel/             React 侧边栏与阅读页面
src/storage/               本地数据结构、校验和备份
scripts/                   构建检查、隐私扫描和本地打包
tests/                     自动测试
docs/                      使用说明、验收记录和产品复盘
```

扩展权限为：

- `sidePanel`：显示 Chrome 侧边栏。
- `tabs`：识别当前 ChatGPT 对话并打开来源页面。
- `storage`：在本机保存收藏和设置。

内容脚本只运行于 `https://chatgpt.com/*`。收藏仅在用户点击后发生；数据不会自动上传到外部服务。Obsidian 导出只写入用户通过浏览器选择并授权的本地文件夹。

## 数据与兼容

关闭侧栏或重启 Chrome 不会清除收藏。卸载扩展会删除 Chrome 保存的本地数据，建议先在「数据与备份」中导出 JSON。

早期版本包含项目、计划、阶段和步骤功能。相关数据仍可通过备份保留，但当前界面已聚焦于“收藏 → 找回原文 → 导出笔记”。历史设计集中保存在 [旧任务管理方案归档](docs/archive/legacy-task-planner/README.md)，产品范围决策见 [产品复盘](docs/PRODUCT_LESSONS.md)。

## 当前状态

当前版本为 v0.4.0。核心流程已经完成，后续优先处理实际使用中反复出现的可靠性和格式问题，不主动扩展为任务管理系统。

当前支持普通 `chatgpt.com/c/<id>` 对话。分享页、自定义 GPT 的其他路径、图片和附件不属于当前收藏范围。网页结构变化可能影响收藏与定位；导出到 Obsidian 的排版和目录授权仍需实际验证。

## 发布与许可证

项目采用 [MIT 许可证](LICENSE)。[隐私说明](docs/PRIVACY.md)介绍本地数据和权限；参与开发见 [CONTRIBUTING.md](CONTRIBUTING.md)。

执行 `npm run release:local` 完成检查并在 `release/` 中生成 Chrome 扩展包和不含 Git 历史的源码包。打包需要系统提供 `zip` 命令，详细流程见 [发布说明](docs/RELEASING.md)。发布包包含运行时依赖的许可证文本。
