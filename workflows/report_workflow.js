"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadDotEnv } = require("../lib/env_loader");
const { publishReport } = require("D:/MEME-/gz/report-publisher/src");
const { createReportPublisher } = require("../lib/report_adapters");

loadDotEnv();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listDataFiles(sourceDir) {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceDir, entry.name))
    .filter((filePath) => [".json", ".csv"].includes(path.extname(filePath).toLowerCase()));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function loadRecords(sourceDir) {
  const files = listDataFiles(sourceDir);
  const records = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".json") {
      const data = readJson(filePath);
      if (Array.isArray(data)) {
        records.push(...data);
      } else if (Array.isArray(data.records)) {
        records.push(...data.records);
      }
    } else if (ext === ".csv") {
      records.push(...parseCsv(fs.readFileSync(filePath, "utf8")));
    }
  }

  return records;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function cleanRecords(records) {
  return records
    .map((record, index) => {
      const date = normalizeDate(record.date || record.day || record.timestamp || record.created_at);
      if (!date) {
        return null;
      }

      return {
        source_index: index,
        date,
        channel: String(record.channel || record.platform || record.source || "unknown").trim() || "unknown",
        views: toNumber(record.views || record.impressions),
        clicks: toNumber(record.clicks),
        leads: toNumber(record.leads || record.inquiries),
        conversions: toNumber(record.conversions || record.orders),
        revenue: toNumber(record.revenue || record.gmv),
      };
    })
    .filter(Boolean);
}

function getDateRange(job) {
  const anchor = new Date(job.anchor_date || new Date().toISOString().slice(0, 10));
  const days = job.report_type === "weekly" ? 7 : 1;
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function summarize(records, range) {
  const filtered = records.filter((record) => record.date >= range.start && record.date <= range.end);
  const totals = filtered.reduce(
    (acc, record) => {
      acc.views += record.views;
      acc.clicks += record.clicks;
      acc.leads += record.leads;
      acc.conversions += record.conversions;
      acc.revenue += record.revenue;
      return acc;
    },
    { views: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 }
  );

  const perDayMap = new Map();
  const channelMap = new Map();
  for (const record of filtered) {
    if (!perDayMap.has(record.date)) {
      perDayMap.set(record.date, { date: record.date, views: 0, leads: 0, revenue: 0 });
    }
    const day = perDayMap.get(record.date);
    day.views += record.views;
    day.leads += record.leads;
    day.revenue += record.revenue;

    if (!channelMap.has(record.channel)) {
      channelMap.set(record.channel, { channel: record.channel, views: 0, leads: 0, revenue: 0 });
    }
    const channel = channelMap.get(record.channel);
    channel.views += record.views;
    channel.leads += record.leads;
    channel.revenue += record.revenue;
  }

  const ctr = totals.views > 0 ? totals.clicks / totals.views : 0;
  const leadRate = totals.clicks > 0 ? totals.leads / totals.clicks : 0;
  const conversionRate = totals.leads > 0 ? totals.conversions / totals.leads : 0;

  return {
    totals,
    metrics: {
      ctr,
      leadRate,
      conversionRate,
    },
    perDay: Array.from(perDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    topChannels: Array.from(channelMap.values())
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)
      .slice(0, 5),
    recordCount: filtered.length,
  };
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function createSvgChart(perDay) {
  const width = 720;
  const height = 320;
  const padding = 40;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const maxViews = Math.max(...perDay.map((row) => row.views), 1);
  const maxRevenue = Math.max(...perDay.map((row) => row.revenue), 1);
  const barWidth = perDay.length > 0 ? innerWidth / perDay.length - 12 : innerWidth;

  const bars = perDay
    .map((row, index) => {
      const x = padding + index * (barWidth + 12);
      const barHeight = Math.round((row.views / maxViews) * (innerHeight - 30));
      const y = height - padding - barHeight;
      const labelY = height - 12;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="#4F46E5" />
        <text x="${x + barWidth / 2}" y="${labelY}" font-size="10" text-anchor="middle" fill="#334155">${row.date.slice(5)}</text>
      `;
    })
    .join("");

  const revenuePoints = perDay
    .map((row, index) => {
      const x = padding + index * (barWidth + 12) + barWidth / 2;
      const y = height - padding - Math.round((row.revenue / maxRevenue) * (innerHeight - 30));
      return `${x},${y}`;
    })
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <text x="${padding}" y="24" font-size="18" font-family="Arial" fill="#0F172A">Views / Revenue Trend</text>
  <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#CBD5E1"/>
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#CBD5E1"/>
  ${bars}
  <polyline fill="none" stroke="#F97316" stroke-width="3" points="${revenuePoints}" />
  <text x="${width - padding - 100}" y="${padding + 10}" font-size="12" fill="#F97316">Revenue</text>
  <text x="${width - padding - 100}" y="${padding + 28}" font-size="12" fill="#4F46E5">Views</text>
</svg>`;
}

function buildMarkdown(job, range, summary, chartFilename) {
  const channelLines = summary.topChannels.length
    ? summary.topChannels
        .map(
          (row, index) =>
            `${index + 1}. ${row.channel}: views ${row.views}, leads ${row.leads}, revenue ${row.revenue.toFixed(2)}`
        )
        .join("\n")
    : "1. No records matched the selected date range.";

  return [
    `# ${job.report_title || "Data Report"}`,
    "",
    `- Report type: ${job.report_type}`,
    `- Date range: ${range.start} ~ ${range.end}`,
    `- Source record count: ${summary.recordCount}`,
    "",
    "## Core Metrics",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Views | ${summary.totals.views} |`,
    `| Clicks | ${summary.totals.clicks} |`,
    `| Leads | ${summary.totals.leads} |`,
    `| Conversions | ${summary.totals.conversions} |`,
    `| Revenue | ${summary.totals.revenue.toFixed(2)} |`,
    `| CTR | ${pct(summary.metrics.ctr)} |`,
    `| Lead Rate | ${pct(summary.metrics.leadRate)} |`,
    `| Conversion Rate | ${pct(summary.metrics.conversionRate)} |`,
    "",
    "## Channel Performance",
    "",
    channelLines,
    "",
    "## Visualization",
    "",
    `![trend](./${chartFilename})`,
    "",
  ].join("\n");
}

async function main() {
  const jobPath = process.argv[2];
  if (!jobPath) {
    throw new Error("Usage: node workflows/report_workflow.js <job.json>");
  }

  const job = readJson(path.resolve(jobPath));
  const sourceDir = path.resolve(job.source_dir);
  const outputDir = path.resolve(job.output_dir);
  ensureDir(outputDir);

  const cleaned = cleanRecords(loadRecords(sourceDir));
  const range = getDateRange(job);
  const summary = summarize(cleaned, range);
  const chartFilename = `${job.report_type}-${range.end}-trend.svg`;
  const reportFilename = `${job.report_type}-${range.end}-report.md`;
  const chartPath = path.join(outputDir, chartFilename);
  const reportPath = path.join(outputDir, reportFilename);
  const svg = createSvgChart(summary.perDay);
  const markdown = buildMarkdown(job, range, summary, chartFilename);
  const publisher = createReportPublisher(job, {
    outputDir,
    reportPath,
    chartPath,
    reportText: markdown,
    reportDate: range.end,
    svg,
  });

  const publishResult = await publishReport(
    {
      report_text: markdown,
      visual_report: {
        filename: chartFilename,
        svg,
      },
      publish_target: "message",
    },
    {
      publishers: {
        message: publisher,
        notion: publisher,
      },
    }
  );

  const result = {
    job,
    range,
    summary,
    publish_result: publishResult,
  };

  fs.writeFileSync(path.join(outputDir, `${job.report_type}-${range.end}-manifest.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  process.exitCode = 1;
});
