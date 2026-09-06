# 待开发需求

## 2026-09-05：导出收藏到 Obsidian

状态：用户已明确启动开发，v0.4 本地实现完成，待浏览器与 Obsidian 手动验收。使用说明见 [Obsidian 导出](OBSIDIAN_EXPORT.md)。

1. 支持将已收藏的回复导出到 Obsidian。
2. 通过目录选择器设置并记住 Obsidian 仓库内的目标文件夹。
3. 导出的 Markdown 文件包含 Obsidian 支持的 YAML frontmatter，记录来源对话（窗口）链接等元数据。

已实现元数据：标题、来源对话链接、对话 ID、消息 ID、收藏 ID、角色、收藏时间、更新时间、导出时间、标签。

支持单条、批量所选及当前列表导出；以收藏 ID 命名 Markdown 文件，重复导出跳过已有文件，保护 Obsidian 内的编辑。
