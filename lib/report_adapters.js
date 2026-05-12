"use strict";

const fs = require("node:fs");

const { requestJson, getEnv, requireEnv } = require("./node_http");

function buildMarkdownBlocks(text) {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: chunk.slice(0, 1900),
            },
          },
        ],
      },
    }));
}

async function saveLocalReport({ reportPath, chartPath, reportText, svg, outputDir }) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, reportText, "utf8");
  if (svg) {
    fs.writeFileSync(chartPath, svg, "utf8");
  }
  return {
    publish_status: "success",
    receipt: {
      target: outputDir,
      provider_status: "saved",
      report_path: reportPath,
      chart_path: chartPath,
    },
  };
}

async function publishToNotion({ reportTitle, reportText, reportDate, svg, reportPath }) {
  const apiKey = requireEnv("NOTION_API_KEY");
  const databaseId = requireEnv("NOTION_DATABASE_ID");
  const titleProperty = getEnv("NOTION_TITLE_PROPERTY", "Name");
  const dateProperty = getEnv("NOTION_DATE_PROPERTY", "Report Date");
  const statusProperty = getEnv("NOTION_STATUS_PROPERTY", "Status");
  const reportUrl = getEnv("REPORT_PUBLIC_BASE_URL")
    ? `${getEnv("REPORT_PUBLIC_BASE_URL").replace(/\/$/, "")}/${encodeURIComponent(reportPath.split(/[\\/]/).pop())}`
    : null;

  const payload = {
    parent: {
      database_id: databaseId,
    },
    properties: {
      [titleProperty]: {
        title: [{ text: { content: reportTitle } }],
      },
      [dateProperty]: {
        date: { start: reportDate },
      },
      [statusProperty]: {
        rich_text: [{ text: { content: "published" } }],
      },
    },
    children: buildMarkdownBlocks(reportText),
  };

  if (reportUrl || svg) {
    payload.children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: reportUrl ? `Artifact: ${reportUrl}` : "Chart artifact saved locally.",
            },
          },
        ],
      },
    });
  }

  const result = await requestJson("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    publish_status: "success",
    receipt: {
      target: "notion",
      provider_status: "created",
      notion_page_id: result.body.id,
      notion_url: result.body.url,
    },
  };
}

async function publishToWebhook({ reportTitle, reportText, reportDate, svg }) {
  const webhookUrl = requireEnv("REPORT_WEBHOOK_URL");
  const authToken = getEnv("REPORT_WEBHOOK_BEARER_TOKEN");
  const result = await requestJson(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      report_title: reportTitle,
      report_date: reportDate,
      report_text: reportText,
      visual_report_svg: svg || null,
    }),
  });

  return {
    publish_status: "success",
    receipt: {
      target: webhookUrl,
      provider_status: "accepted",
      webhook_status: result.status,
      response: result.body,
    },
  };
}

function createReportPublisher(job, artifacts) {
  const provider = (job.publish_provider || "local").toLowerCase();

  return async () => {
    if (provider === "local") {
      return saveLocalReport(artifacts);
    }
    if (provider === "notion") {
      await saveLocalReport(artifacts);
      return publishToNotion({
        reportTitle: job.report_title || "Data Report",
        reportText: artifacts.reportText,
        reportDate: artifacts.reportDate,
        svg: artifacts.svg,
        reportPath: artifacts.reportPath,
      });
    }
    if (provider === "webhook") {
      await saveLocalReport(artifacts);
      return publishToWebhook({
        reportTitle: job.report_title || "Data Report",
        reportText: artifacts.reportText,
        reportDate: artifacts.reportDate,
        svg: artifacts.svg,
      });
    }
    throw new Error(`Unsupported report publish_provider: ${provider}`);
  };
}

module.exports = {
  createReportPublisher,
};
