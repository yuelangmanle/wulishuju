# ProSolo 读数提取助手

本地 HTML 页面，支持批量导入 ProSolo 屏幕照片，按拍摄时间排序，调用视觉模型提取温度、氧分压、DO% 和 DO mg/L，最后导出 Excel。默认已填入 ModelScope 推理地址与 Qwen3-Coder 模型。

## 使用
1. 打开 `index.html`（直接双击或用浏览器打开即可，无需启动服务器）。
2. “API Provider” 选择 OpenAI Compatible/ModelScope/Azure；确认 Base URL（默认 `https://api-inference.modelscope.cn/v1`）；填写兼容 API Key（本地存储）；Model ID 默认 `Qwen/Qwen3-Coder-30B-A3B-Instruct` 可自行修改。
3. 如需额外头部，可用 “Add Header” 增加（未设置时自动使用 `Authorization: Bearer <Key>`）。
4. 可调整“首张深度标签”“间隔(m)”；导入后可在列表里逐条修改深度。
5. 可保存/切换多套 API 方案；支持导出/导入配置（包含方案、Headers、间隔/重试、缓存开关）；“检查 API”用于快速探测 Key/模型是否可用。
6. 支持导入 CSV 预填深度/采样点：列为 `filename,depth,point,isPointStart(0/1)`。
7. 识别节奏可调（间隔、重试），可暂停/继续；列表支持筛选仅错误/未识别/未处理。
8. 点击或拖拽批量导入图片，自动按拍摄时间排序；列表里可对任意照片点击“设为此起点”，从该张开始算新的采样点（第一张自动为点1起点）。
9. 点击“开始AI识别”触发识别；可单张“重试识别”；完成后“导出 Excel”生成 `prosolo-readings.xlsx`，可附带文件名/时间/错误信息（选项勾选）。

## 提取逻辑
- 默认为 `Qwen/Qwen3-Coder-30B-A3B-Instruct`（可切换/填写其他模型，如 `Qwen/Qwen3-VL-23B-A22B-Instruct` 或 `gpt-4o-mini`/`gpt-4o`），提示模型输出 JSON；读不清的字段返回 `null`，导出时对应单元格留空。
- 导出布局：按采样点分块，每个采样点四列（温度℃、氧分压mmHg、DO%、DOmg/L），左侧一列为水深(m)；水深按数值升序汇总各点深度，缺失处留空。
- 点击缩略图可放大核对，确保顺序无误；采样点起点可在卡片按钮切换。
- 识别请求前会将图片压缩到约 1.6MB 内（1600px 最长边、0.7 品质，自适应降低），避免 `Exceeded limit on max bytes per data-uri`。

## 依赖
- 通过 CDN 引入：`exifr` 读取 EXIF 时间，`xlsx` 导出 Excel。
- 全部运行在浏览器，无需额外安装。

## 部署到 GitHub Pages
仓库中已添加 `.github/workflows/pages.yml`，Push 即自动部署：
1. 将代码推送到 GitHub 仓库的 `main`（或 `master`）分支。
2. 打开仓库 Settings → Pages，选择 “Deploy from a branch”，分支选 `main`（或 `master`），目录选 `/ (root)` 保存。
3. 等待 Actions 完成，Pages 地址类似 `https://<yourname>.github.io/<repo>/`。
4. 若大陆访问缓慢，可用 jsDelivr 反代：`https://cdn.jsdelivr.net/gh/<yourname>/<repo>/index.html`（资源路径已相对）。

## 部署到 Gitee Pages
仓库中已添加 `.gitee/workflows/pages.yml`（基于 yanglbme/gitee-pages-action），使用方法：
1. 在 Gitee 创建同名仓库，并配置三项 Secrets（在 GitHub 仓库 Settings → Secrets → Actions）：
   - `GITEE_TOKEN`: Gitee 私人令牌（有 Pages 发布权限）
   - `GITEE_USERNAME`: 你的 Gitee 用户名
   - `GITEE_PASSWORD`: 你的 Gitee 密码（如不希望存密码，可改为使用 cookie 方式，参考 action 文档）
   - `GITEE_REPO`: 形如 `username/repo`
2. 将代码推送到 GitHub 仓库的 `main`/`master`，Workflow 会自动在 Gitee 仓库触发 Pages 发布。
3. 在 Gitee 仓库启用 Pages（设置 → Pages），默认分支 `main`，保存后访问对应 Gitee Pages 地址。
