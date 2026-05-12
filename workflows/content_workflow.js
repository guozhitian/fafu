"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadDotEnv } = require("../lib/env_loader");
const { runContentPublisher } = require("D:/MEME-/gz/content-publisher/src/index");
const { routeLead } = require("D:/MEME-/gz/lead-router/src/index");
const { createContentPublisher } = require("../lib/content_adapters");

loadDotEnv();

const PLATFORM_RULES = {
  douyin: {
    titleMax: 55,
    copyMax: 500,
    hashtagMax: 8,
    requireMedia: true,
  },
  xiaohongshu: {
    titleMax: 20,
    copyMax: 1000,
    hashtagMax: 10,
    requireMedia: true,
  },
  wechat: {
    titleMax: 64,
    copyMax: 2000,
    hashtagMax: 5,
    requireMedia: false,
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function validatePlatformRules(input) {
  const rules = PLATFORM_RULES[input.platform];
  if (!rules) {
    throw new Error(`Unsupported platform: ${input.platform}`);
  }

  if (input.title.trim().length > rules.titleMax) {
    throw new Error(`Title exceeds ${input.platform} limit: ${rules.titleMax}`);
  }
  if (input.copy.trim().length > rules.copyMax) {
    throw new Error(`Copy exceeds ${input.platform} limit: ${rules.copyMax}`);
  }
  if (input.hashtags.length > rules.hashtagMax) {
    throw new Error(`Hashtag count exceeds ${input.platform} limit: ${rules.hashtagMax}`);
  }
  if (rules.requireMedia && input.media.length === 0) {
    throw new Error(`Platform ${input.platform} requires at least one media asset.`);
  }
}

async function main() {
  const jobPath = process.argv[2];
  if (!jobPath) {
    throw new Error("Usage: node workflows/content_workflow.js <job.json>");
  }

  const job = readJson(path.resolve(jobPath));
  const outputDir = path.resolve(job.output_dir);
  ensureDir(outputDir);
  validatePlatformRules(job);
  const publisher = createContentPublisher(job, outputDir);

  const publishResult = await runContentPublisher(job, {
    publisher,
  });

  if (!publishResult.success) {
    throw new Error(JSON.stringify(publishResult.error));
  }

  const leadResult = routeLead({
    intent: job.intent,
    session_context: job.session_context,
    reply_guard: job.reply_guard || {},
  });
  if (!leadResult.success) {
    throw new Error(JSON.stringify(leadResult.error));
  }

  const leadRecord = {
    content_id: publishResult.data.content_id,
    lead_needed: leadResult.data.lead_needed,
    lead_type: leadResult.data.lead_type,
    routed_at: new Date().toISOString(),
    source_platform: job.platform,
  };

  fs.writeFileSync(
    path.join(outputDir, `${publishResult.data.content_id}.lead.json`),
    JSON.stringify(leadRecord, null, 2)
  );

  const result = {
    success: true,
    data: {
      publish_result: publishResult.data.publish_result,
      content_id: publishResult.data.content_id,
      verification_status: "verified",
      lead_result: leadRecord,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  process.exitCode = 1;
});
