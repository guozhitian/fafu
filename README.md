# Workflow Wrappers

这个目录提供了 3 个可独立运行的工作流，用来承接你提到的三类需求，并直接复用已有模块能力。

## 1. 报表生成

- 脚本: `workflows/report_workflow.js`
- 使用模块: `report-publisher`
- 能力: 读取目录中的 JSON/CSV 原始数据，清洗并统计，生成 Markdown 报告与 SVG 趋势图，保存到指定目录。
- 真实接口: 支持 `publish_provider=notion` 或 `publish_provider=webhook`

运行:

```bash
node workflows/report_workflow.js samples/report_job.json
```

输出目录:

- `outputs/report/*.md`
- `outputs/report/*.svg`
- `outputs/report/*manifest.json`

真实接入所需环境变量:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- 或 `REPORT_WEBHOOK_URL`

## 2. 自动回复

- 脚本: `workflows/reply_workflow.py`
- 使用模块: `knowledge-retriever` + `reply-drafter`
- 能力: 检索知识、生成商业化回复、模拟自动发送，并将会话内容记录到本地日志。
- 真实接口: 支持 `REPLY_SEND_MODE=webhook` 或 `REPLY_SEND_MODE=wecom_bot`

运行:

```bash
python workflows/reply_workflow.py samples/reply_job.json
```

输出目录:

- `outputs/reply/sent_messages.jsonl`
- `outputs/reply/<session_id>.json`

真实接入所需环境变量:

- `REPLY_SEND_MODE`
- `REPLY_WEBHOOK_URL` 或 `WECOM_BOT_WEBHOOK`
- 可选 `REPLY_LOG_WEBHOOK_URL`

## 3. 自动发布与引流

- 脚本: `workflows/content_workflow.js`
- 使用模块: `content-publisher` + `lead-router`
- 能力: 校验平台规则、生成发布结果、验证成功、输出内容编号，并根据咨询/评论意图生成线索记录。
- 真实接口: 支持 `publish_provider=generic_api`，也支持 `publish_provider=douyin_h5` 调用抖音官方 H5 分享跳转接口

运行:

```bash
node workflows/content_workflow.js samples/content_job.json
```

输出目录:

- `outputs/content/*.publish.json`
- `outputs/content/*.lead.json`

真实接入所需环境变量:

- `CONTENT_API_URL`
- 或 `DOUYIN_CLIENT_KEY`、`DOUYIN_CLIENT_SECRET`、`DOUYIN_CLIENT_TICKET`

## 说明

- 当前实现优先保证“需求可实现、可演示、可继续接系统”。
- 默认仍保留 `local` mock 适配器，未配置环境变量时不会误调用线上接口。
- 抖音这里接的是官方 H5 分享跳转接口，代码会请求官方 `schema/get_share`；`client_ticket` 建议由你们已有授权链路或服务端缓存提供。
- 所有环境变量模板见 [.env.example](/D:/MEME-/ggzzmax/fafu/.env.example:1)。
