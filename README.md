# GuideRail

GuideRail 是一个**本地优先（Local-First）**的 Chrome 侧边栏扩展 + Obsidian 桌面配套插件：在 ChatGPT 中一键收藏有价值的回复与图片，直接保存到自己的本地 Obsidian 笔记库或普通文件夹，随时在侧栏沉浸阅读或定位回网页原文。

没有账号体系、没有云端服务器，也不调用任何第三方 AI API，数据 100% 留在你的本地设备中。

---

## 📦 下载与安装包获取

请前往 **[GitHub Releases 最新版本](https://github.com/leoyang1984/guiderail-public/releases/latest)** 下载已编译打包的成品插件：

- **`GuideRail-0.6.8-chrome-*.zip`**：Chrome 浏览器扩展程序安装包。
- **`GuideRail-0.6.8-obsidian-companion-*.zip`**：Obsidian 桌面端配套插件包。

---

## 🚀 快速上手与使用方法

### 第一步：安装 Chrome 扩展
1. 在 [Releases](https://github.com/leoyang1984/guiderail-public/releases/latest) 中下载 `GuideRail-0.6.8-chrome-*.zip`，解压到本地固定文件夹（如你的文档或工具目录）；
2. 在 Chrome 浏览器地址栏打开 `chrome://extensions`；
3. 打开右上角的 **「开发者模式」** 开关；
4. 点击左上角的 **「加载已解压的扩展程序」**，选择刚才解压出来的文件夹；
5. 点击 Chrome 工具栏右上角的拼图图标，将 **GuideRail** 固定到工具栏。

### 第二步：安装 Obsidian Companion 插件（推荐）
1. 在 [Releases](https://github.com/leoyang1984/guiderail-public/releases/latest) 中下载 `GuideRail-0.6.8-obsidian-companion-*.zip`；
2. 打开你的 Obsidian 笔记库（Vault）所在目录，进入 `.obsidian/plugins/` 目录；
3. 新建名为 `obsidian-companion` 的文件夹，将压缩包内的 `main.js` 和 `manifest.json` 解压至该文件夹：
   ```text
   <你的 Vault 根目录>/
     .obsidian/
       plugins/
         obsidian-companion/
           manifest.json
           main.js
   ```
4. 打开 Obsidian，进入 **设置 -> 第三方插件 (Community plugins)**，刷新插件列表后找到 **GuideRail Companion** 并开启。

### 第三步：两端配对与连接
1. 在 Obsidian 中打开 **GuideRail Companion** 设置面板：
   - **保存根目录**：建议**保持空白（留空）**。留空代表直接保存在 Vault 根目录的“收件箱/”文件夹内；
   - 点击 **【生成配对码】**，8 位配对码会**自动复制到系统剪贴板**，同时也提供右侧【复制配对码】按钮；
2. 点击 Chrome 工具栏上的 GuideRail 图标打开侧边栏（Sidepanel）；
3. 在侧边栏的配对界面中，粘贴刚才生成的 8 位配对码，点击 **【连接 Obsidian】**；
4. 侧边栏将立即显示 `Obsidian Companion (已连接: <你的 Vault 名称>)`，两端即刻连通！

> *注：如果不使用 Obsidian，也可在侧边栏点击“选择保存文件夹”，直接授权本地普通磁盘目录。*

### 第四步：在 ChatGPT 中一键收藏与管理
1. 打开任意 `https://chatgpt.com/c/<对话ID>` 页面（首次安装或更新后，请**刷新一次**已打开的 ChatGPT 页面）；
2. 在任意助手回复的底部操作栏中，点击 GuideRail 注入的 **「☆ 收藏」** 按钮；
3. 按钮变为 **「✓ 已收藏」**，Markdown 笔记与对应图片附件（保存在 `attachments/` 目录）已直接写入你的 Obsidian Vault；
4. 打开 Chrome 侧边栏：
   - 随时沉浸阅读已收藏的笔记和图片；
   - 点击顶部「回到原回复」，一键滚动定位到 ChatGPT 网页的原文位置；
   - 点击卡片右下角「更多操作」，可重命名标题、新建分类文件夹并移动笔记归档；
   - 点击侧栏右上角调色板图标，可在 5 款 Bear 风格精选主题（日间、夜间、雪国、羊皮纸等）中无缝切换。

---

## 核心功能

- **沉浸阅读与原文跳转**：在 Chrome 侧边栏优雅阅读已保存的 Markdown 内容和图片；点击顶部「回到原回复」，一键定位并滚动到 ChatGPT 网页中的对应回复位置。
- **自动抓取图片附件**：完整支持 ChatGPT 回复中生成的图片或配图，自动下载并以相对路径保存在笔记库的 `attachments/` 目录，离线随时可看。
- **笔记分类与管理**：
  - 新笔记默认进入「收件箱」；
  - 支持在侧边栏中修改笔记标题、新建文件夹并将笔记与对应附件一起移动归档；
  - 支持按文件夹标签（`#全部`、`#收件箱` 等）快速筛选浏览。
- **Bear 风格多主题切换**：内置跟随系统、红石墨日间、红石墨夜间、北欧雪国、羊皮纸 5 款精心调优的经典主题，点击侧栏右上角调色板图标即可一键无缝切换。
- **零外部依赖与隐私安全**：服务只监听本机 `127.0.0.1` 环回接口，配对采用 256 位安全令牌，无需暴露任何网络端口，不上传任何隐私。

---

## 笔记库存储结构

写入 Obsidian Vault 或本地文件夹的文件组织方式如下：

```text
我的笔记库 (Vault)/
  .guiderail/
    index.json              # 本地笔记索引缓存
  收件箱/
    <稳定ID>.md              # 自动保存的 Markdown 笔记
    attachments/
      <稳定ID>/
        0.png               # 抓取的回复图片附件
        1.webp
  工作项目/                  # 在侧边栏整理或移动后建立的分类文件夹
    <稳定ID>.md
```

- **Markdown 属性**：每篇笔记顶部包含 Frontmatter（标题、来源 URL、对话 ID、消息 ID、收藏时间等信息）。
- **图片相对路径**：完全兼容 Obsidian 标准 Markdown 语法 `![图片](attachments/<ID>/0.png)`，移动笔记时附件同步迁移。
- **防止覆盖**：重复收藏或在 Obsidian 中已手动编辑的文件不会被无故覆盖。

---

## 常见问题排查 (FAQ)

1. **点击“☆ 收藏”提示“请先在插件中设置笔记库”？**
   - 说明扩展尚未完成笔记库配置。请点击 Chrome 工具栏打开 GuideRail 侧边栏，根据指引完成与 Obsidian 的配对（或选择本地文件夹）即可。
2. **连接 Obsidian 时提示无法连接？**
   - 请确认 Obsidian 桌面端处于打开运行状态，且已在 Obsidian 设置中启用了 GuideRail Companion 插件。
3. **刚安装或更新扩展后，ChatGPT 页面上没有出现“收藏”按钮？**
   - 请按 `F5` 或 `Cmd + R` 刷新一次当前的 ChatGPT 网页，让浏览器加载最新注入的内容脚本。
4. **Obsidian“保存根目录”应该填什么？**
   - 建议**留空**。留空表示直接保存在 Vault 根目录的“收件箱/”文件夹内；如果填写了“收件箱”，实际路径会变成“收件箱/收件箱/”。

---

## 许可证

本项目插件遵照 [MIT 许可证](LICENSE) 分发。
