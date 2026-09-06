# 参与开发

先阅读 [产品范围复盘](docs/PRODUCT_LESSONS.md)。新需求应说明实际场景、反复出现的不便及最小验收结果。

使用 Node.js 22.12+：

```sh
npm ci
npm run check:privacy
npm test
npm run build
```

提交前执行 `git diff --check`。与 Chrome 交互、目录授权及视觉相关的修改，应说明实际验证方式和未验证部分。测试使用虚构对话 ID 和内容，不上传真实回复、个人备份、凭据或机器路径。

历史文档在 `docs/archive/`。部分领域逻辑仍用于旧数据迁移和校验，不要仅因当前界面没有入口就删除它们。个人笔记放入被忽略的 `.local/`。

贡献按项目 MIT 许可证提供。请在提交前配置自己的 Git 提交邮箱；如不希望暴露个人邮箱，可使用 GitHub 提供的 noreply 地址。
