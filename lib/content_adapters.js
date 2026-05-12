"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { requestJson, getEnv, requireEnv } = require("./node_http");

function makeContentId(platform, title) {
  return `${platform}-${crypto.createHash("md5").update(title).digest("hex").slice(0, 10)}`;
}

async function publishLocal(payload, outputDir) {
  const contentId = makeContentId(payload.platform, payload.title);
  const receipt = {
    content_id: contentId,
    platform: payload.platform,
    published_at: new Date().toISOString(),
    title: payload.title,
    copy: payload.copy,
    hashtags: payload.hashtags,
    media: payload.media,
    verification: {
      asset_count: payload.media.length,
      title_length: payload.title.length,
    },
  };
  fs.writeFileSync(path.join(outputDir, `${contentId}.publish.json`), JSON.stringify(receipt, null, 2));
  return {
    publish_result: "success",
    content_id: contentId,
  };
}

async function publishGenericApi(payload, outputDir) {
  const endpoint = requireEnv("CONTENT_API_URL");
  const token = getEnv("CONTENT_API_BEARER_TOKEN");
  const result = await requestJson(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      title: payload.title,
      copy: payload.copy,
      hashtags: payload.hashtags,
      media: payload.media,
      platform: payload.platform,
    }),
  });

  const contentId = result.body && result.body.content_id ? result.body.content_id : makeContentId(payload.platform, payload.title);
  fs.writeFileSync(
    path.join(outputDir, `${contentId}.publish.json`),
    JSON.stringify(
      {
        content_id: contentId,
        upstream_response: result.body,
        published_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  return {
    publish_result: "success",
    content_id: contentId,
  };
}

async function createDouyinH5Share(payload, outputDir) {
  const clientKey = requireEnv("DOUYIN_CLIENT_KEY");
  const clientTicket = requireEnv("DOUYIN_CLIENT_TICKET");

  const tokenResult = await requestJson("https://open.douyin.com/oauth/client_token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_key: clientKey,
      client_secret: requireEnv("DOUYIN_CLIENT_SECRET"),
      grant_type: "client_credential",
    }),
  });

  const accessToken = tokenResult.body.access_token;
  const expireAt = Math.floor(Date.now() / 1000) + 3600;
  const sharePayload = {
    client_ticket: clientTicket,
    expire_at: expireAt,
    title: payload.title,
    hashtag_list: payload.hashtags,
    share_to_publish: payload.media.length === 1 && /\.((mp4)|(mov))$/i.test(payload.media[0]) ? 1 : 0,
  };
  if (payload.media.length === 1) {
    if (/\.((mp4)|(mov))$/i.test(payload.media[0])) {
      sharePayload.video_path = payload.media[0];
    } else {
      sharePayload.image_path = payload.media[0];
    }
  } else if (payload.media.length > 1) {
    sharePayload.image_list_path = payload.media;
  }

  const ticketResult = await requestJson("https://open.douyin.com/api/douyin/v1/schema/get_share/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access-token": accessToken,
    },
    body: JSON.stringify(sharePayload),
  });

  const contentId = makeContentId(payload.platform, payload.title);
  fs.writeFileSync(
    path.join(outputDir, `${contentId}.publish.json`),
    JSON.stringify(
      {
        content_id: contentId,
        platform: "douyin_h5",
        access_token_expires_in: tokenResult.body.expires_in,
        share_link_response: ticketResult.body,
      },
      null,
      2
    )
  );

  return {
    publish_result: "success",
    content_id: contentId,
  };
}

function createContentPublisher(job, outputDir) {
  const provider = (job.publish_provider || "local").toLowerCase();
  return async (payload) => {
    if (provider === "local") {
      return publishLocal(payload, outputDir);
    }
    if (provider === "generic_api") {
      return publishGenericApi(payload, outputDir);
    }
    if (provider === "douyin_h5") {
      return createDouyinH5Share(payload, outputDir);
    }
    throw new Error(`Unsupported content publish_provider: ${provider}`);
  };
}

module.exports = {
  createContentPublisher,
};
