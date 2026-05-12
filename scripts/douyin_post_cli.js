"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_DIR = path.resolve(__dirname, "..", "outputs", "content");
const IMAGE_ROOT = path.join(OUTPUT_DIR, "generated-images");
const TASK_ROOT = path.join(OUTPUT_DIR, "publish-tasks");
const MATERIAL_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const OFOX_OPENAI_BASE = "https://api.ofox.ai/v1";
const OFOX_IMAGE_ENDPOINT = `${OFOX_OPENAI_BASE}/images/generations`;
const NANO_BANANA_MODEL = "google/gemini-3.1-flash-image-preview";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function todayId(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function cleanText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function contentId(prefix = "douyin-note") {
  return `${prefix}-${Date.now().toString(36)}`;
}

function outputDateDir(date = new Date()) {
  const dir = path.join(IMAGE_ROOT, todayId(date));
  ensureDir(dir);
  return dir;
}

function extractJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function hiddenStyleGuardrails() {
  return [
    "Follow the topic first and choose the scene based on the topic instead of defaulting to a dentist-at-work scene.",
    "Suitable for mainland China local-platform aesthetics, polished domestic commercial taste, familiar clinic branding style.",
    "If people appear, they must look like local Chinese customers or doctors. Do not generate foreign-looking faces or overseas clinic style.",
    "No bloody procedure, no surgery close-up, no exaggerated before-after, no false guarantee, no horror medical imagery.",
    "Use bright natural light, calm green and white clinic palette, 4:5 vertical composition, and infographic-friendly layout when the topic is educational."
  ].join(" ");
}

function promptSeed(payload) {
  const topic = cleanText(payload.topic) || "dental education";
  const project = cleanText(payload.project) || "dental service";
  const audience = cleanText(payload.audience) || "local urban audience";
  const offer = cleanText(payload.offer) || "private message for booking";
  return [
    `Douyin image-text carousel for a dental clinic, topic: ${topic}.`,
    `Service: ${project}. Audience: ${audience}. Offer: ${offer}.`,
    hiddenStyleGuardrails()
  ].join(" ");
}

function promptVariants(payload, count = 1) {
  const total = Math.max(1, Math.min(Number(count || 1), 18));
  const topic = cleanText(payload.topic) || "dental topic";
  const project = cleanText(payload.project) || "dental service";
  const audience = cleanText(payload.audience) || "local dental audience";
  const offer = cleanText(payload.offer) || "private message for booking";
  const sceneSeeds = [
    "educational infographic layout about the topic, clean charts, icons, and key points",
    "oral-health science poster style, clear visual hierarchy, commercial Chinese social cover",
    "premium dental clinic interior with warm reception and clean smile branding",
    "close-up smile portrait with polished teeth and reassuring clinic atmosphere",
    "orthodontic consultation moment with tablet explanation and calm posture",
    "bright waiting area with local clinic campaign styling and lifestyle feel",
    "non-invasive dental checkup scene with trustworthy communication",
    "young local Chinese adult discussing options with a friendly local dentist",
    "family-friendly dental environment with bright, clean commercial composition",
    "city clinic branding visual with premium healthcare marketing tone"
  ];

  return Array.from({ length: total }, (_, index) => [
    `Douyin image-text cover for a dental clinic campaign about ${topic}.`,
    `Service focus: ${project}. Audience: ${audience}. Offer: ${offer}.`,
    `Scene ${index + 1}: ${sceneSeeds[index % sceneSeeds.length]}.`,
    "The visual scene should match the topic and may be infographic-like, educational, lifestyle-based, or clinic-based as needed.",
    "Premium but approachable mainland China aesthetic, local-platform commercial taste, not western stock-photo style.",
    "If people appear, they must look like local Chinese people. Do not generate foreign-looking faces.",
    "No bloody procedure, no surgery close-up, no exaggerated before-after, no false guarantee.",
    "Bright natural light, green and white clinic palette, clean smile, 4:5 vertical composition, high click-through social media cover."
  ].join(" "));
}

function resolveImageModel(model) {
  const normalized = cleanText(model).toLowerCase();
  if (!normalized || normalized === "nanobanana2" || normalized === "nano-banana-2") {
    return NANO_BANANA_MODEL;
  }
  return model;
}

function resolveImageEndpoint(endpoint) {
  return cleanText(endpoint) || OFOX_IMAGE_ENDPOINT;
}

function sizeFromAspectRatio(aspectRatio) {
  if (aspectRatio === "4:5") return "1024x1536";
  if (aspectRatio === "3:4") return "1024x1536";
  if (aspectRatio === "16:9") return "1536x1024";
  return "1024x1536";
}

function fallbackPost(payload) {
  const topic = cleanText(payload.topic) || "口腔护理";
  const project = cleanText(payload.project) || "口腔检查";
  return {
    title: `${project}到店前先看这篇`,
    body: `最近很多朋友咨询${topic}。每个人牙齿基础、咬合和预算都不同，建议先做一次口腔检查，再让医生给出更适合的方案。评论或私信回复“${payload.leadKeyword || "预约"}”，客服帮你安排到店时间。`,
    hashtags: ["口腔健康", "牙齿护理", "同城口腔", project].filter(Boolean),
    image_prompt: promptSeed(payload),
    image_prompts: promptVariants(payload, Number(payload.count || 1)),
    publish_fields: {
      title: "抖音图文标题",
      body: "图文正文/描述",
      hashtags: "话题标签",
      images: "1-18 张图片，建议 3-6 张",
      cover: "首图默认封面",
      schedule_time: "定时发布时间",
      visibility: "公开/仅自己可见"
    },
    compliance_notes: ["不承诺疗效", "价格引导到店检查后确认", "避免治疗前后强对比"]
  };
}

async function callDeepSeek(payload, prompt) {
  const endpoint = `${String(payload.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify({
      model: payload.model || "deepseek-chat",
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: "你是严谨的口腔门店抖音图文运营，必须遵守医疗合规边界，并输出可直接解析的 JSON。"
        },
        { role: "user", content: prompt }
      ]
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text)?.choices?.[0]?.message?.content || "";
}

async function generatePrompt(payload) {
  const promptCount = Math.max(1, Math.min(Number(payload.count || 1), 18));
  if (!payload.apiKey) {
    const prompts = promptVariants(payload, promptCount);
    const post = fallbackPost({ ...payload, count: promptCount });
    post.image_prompt = prompts[0];
    post.image_prompts = prompts;
    return { ok: true, provider: "fallback", prompt: prompts[0], prompts, post };
  }

  const prompt = [
    "请只输出 JSON，不要 Markdown。",
    `JSON 字段：title, body, hashtags, image_prompt, image_prompts, publish_fields, compliance_notes。`,
    `image_prompts 必须是 ${promptCount} 条英文图片提示词数组，一条提示词对应一张图。`,
    "image_prompt 取第 1 条作为总提示词，但后续生图以 image_prompts 为准。",
    "任务：为口腔门店抖音图文生成标题、正文、话题标签，并生成适合 Nano Banana 2 图片模型的英文图片提示词。",
    "要求：不要承诺疗效；不要夸大治疗效果；价格只引导到店检查确认；正文里带私信或评论引流动作。",
    "图片隐藏要求：画面要跟选题走，不要默认都做牙医现场；如果出现人物，要符合中国本地审美和国内平台商业视觉，不要出现外国人脸。",
    `选题：${payload.topic || ""}`,
    `项目：${payload.project || ""}`,
    `目标人群：${payload.audience || ""}`,
    `活动/卖点：${payload.offer || ""}`,
    `引流关键词：${payload.leadKeyword || "预约"}`,
    `门店资料/SOP：${String(payload.knowledgeText || "").slice(0, 2000)}`
  ].join("\n");

  const content = await callDeepSeek(payload, prompt);
  const post = extractJson(content);
  const prompts = Array.isArray(post.image_prompts)
    ? post.image_prompts.map((item) => cleanText(item)).filter(Boolean).slice(0, promptCount)
    : [];
  if (!prompts.length) {
    prompts.push(...promptVariants(payload, promptCount));
  }
  while (prompts.length < promptCount) {
    prompts.push(promptVariants(payload, promptCount)[prompts.length]);
  }
  post.image_prompts = prompts;
  post.image_prompt = cleanText(post.image_prompt) || prompts[0] || promptSeed(payload);
  return { ok: true, provider: "deepseek", prompt: post.image_prompt, prompts, post };
}

function svgPlaceholder(prompt, index) {
  const safePrompt = cleanText(prompt).replace(/[<>&]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6fbf8"/>
      <stop offset="100%" stop-color="#d7e8e0"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="92" y="110" width="896" height="1130" rx="42" fill="#ffffff" stroke="#bfd6cb" stroke-width="4"/>
  <text x="130" y="240" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#173f36">口腔图文封面 ${index}</text>
  <text x="130" y="330" font-family="Arial, sans-serif" font-size="36" fill="#31564c">Nano Banana 2 Prompt Preview</text>
  <foreignObject x="130" y="410" width="820" height="520">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:34px;line-height:1.45;color:#334;word-break:break-word;">${safePrompt}</div>
  </foreignObject>
  <circle cx="795" cy="1015" r="110" fill="#35b08f" opacity="0.18"/>
  <path d="M245 960 C360 875, 470 890, 565 980 S760 1100, 880 980" fill="none" stroke="#35b08f" stroke-width="24" stroke-linecap="round"/>
  <text x="130" y="1165" font-family="Arial, sans-serif" font-size="34" fill="#47645b">Generated placeholder. Configure image API for real output.</text>
</svg>`;
}

function saveImageLike(image, prompt, index, targetDir) {
  const id = image.id || `image-${Date.now().toString(36)}-${index}`;
  const base = path.join(targetDir, `${String(index).padStart(2, "0")}-${id}`);

  if (image.b64_json || image.base64) {
    const filePath = `${base}.png`;
    fs.writeFileSync(filePath, Buffer.from(image.b64_json || image.base64, "base64"));
    return { ...image, file_path: filePath, public_path: `/generated-images/${path.basename(targetDir)}/${path.basename(filePath)}` };
  }

  if (image.url && /^data:image\//.test(image.url)) {
    const [, meta, data] = image.url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/) || [];
    const ext = meta?.includes("jpeg") ? ".jpg" : ".png";
    const filePath = `${base}${ext}`;
    fs.writeFileSync(filePath, Buffer.from(data || "", "base64"));
    return { ...image, file_path: filePath, public_path: `/generated-images/${path.basename(targetDir)}/${path.basename(filePath)}` };
  }

  const filePath = `${base}.svg`;
  fs.writeFileSync(filePath, svgPlaceholder(prompt, index), "utf8");
  return {
    ...image,
    type: image.type || "placeholder",
    file_path: filePath,
    public_path: `/generated-images/${path.basename(targetDir)}/${path.basename(filePath)}`
  };
}

async function generateImages(payload) {
  const promptList = Array.isArray(payload.prompts)
    ? payload.prompts.map((item) => cleanText(item)).filter(Boolean)
    : String(payload.prompt || "")
        .split(/\r?\n+/)
        .map((item) => cleanText(item))
        .filter(Boolean);
  const prompt = promptList[0] || cleanText(payload.prompt);
  const count = Math.max(1, Math.min(Number(payload.count || 1), 18));
  const model = resolveImageModel(payload.model || "nanobanana2");
  const endpoint = resolveImageEndpoint(payload.endpoint);
  if (!prompt) throw new Error("Missing image prompt.");
  const prompts = promptList.length ? promptList.slice(0, count) : promptVariants(payload, count);
  while (prompts.length < count) {
    prompts.push(prompts[prompts.length - 1] || prompt);
  }

  const targetDir = outputDateDir(payload.date ? new Date(payload.date) : new Date());
  let images = [];
  let provider = "nanobanana2-placeholder";
  let status = "generated_placeholder";

  if (payload.apiKey) {
    const isGeminiImageModel = model === NANO_BANANA_MODEL;
    const imageCalls = isGeminiImageModel
      ? prompts.map((currentPrompt) => ({
          model,
          prompt: currentPrompt,
          size: sizeFromAspectRatio(payload.aspectRatio || "4:5"),
          quality: payload.quality || "low",
          output_format: "png"
        }))
      : [{
          model,
          prompt: prompts.join("\n"),
          size: sizeFromAspectRatio(payload.aspectRatio || "4:5"),
          quality: payload.quality || "low",
          output_format: "png",
          n: count
        }];

    const generated = [];
    for (let index = 0; index < imageCalls.length; index += 1) {
      const body = imageCalls[index];
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${payload.apiKey}`
        },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Image API HTTP ${response.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      const currentImages = json.images || json.data || [];
      if (isGeminiImageModel) {
        generated.push(...currentImages.map((image) => ({ ...image, prompt_used: prompts[index] })));
      } else {
        generated.push(...currentImages);
      }
    }
    images = generated;
    provider = endpoint.includes("ofox.ai") ? "ofox-openai-images" : "nanobanana2";
    status = "generated";
  } else {
    images = Array.from({ length: count }, (_, index) => ({
      id: `nanobanana2-placeholder-${Date.now().toString(36)}-${index + 1}`,
      type: "placeholder",
      model,
      prompt: prompts[index]
    }));
  }

  const savedImages = images.map((image, index) => {
    const promptUsed = image.prompt_used || image.prompt || prompts[index] || prompt;
    return saveImageLike({ ...image, model, prompt: promptUsed }, promptUsed, index + 1, targetDir);
  });
  const manifestPath = path.join(targetDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ ok: true, provider, status, prompt, prompts, model, images: savedImages }, null, 2), "utf8");
  return { ok: true, provider, status, output_dir: targetDir, manifest_path: manifestPath, prompt, prompts, images: savedImages };
}

function fileToMaterial(filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    name: path.basename(filePath),
    file_path: filePath,
    ext,
    size: stat.size,
    public_path: filePath.startsWith(IMAGE_ROOT)
      ? `/generated-images/${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`
      : "",
    source: filePath.startsWith(IMAGE_ROOT) ? "generated" : "local"
  };
}

function listMaterials(payload) {
  const sourceDir = payload.sourceDir
    ? path.resolve(payload.sourceDir)
    : path.join(IMAGE_ROOT, payload.date || todayId());
  if (!fs.existsSync(sourceDir)) return { ok: true, source_dir: sourceDir, materials: [] };

  const materials = fs.readdirSync(sourceDir)
    .map((name) => path.join(sourceDir, name))
    .filter((filePath) => fs.statSync(filePath).isFile() && MATERIAL_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map(fileToMaterial);

  return { ok: true, source_dir: sourceDir, materials };
}

async function generateCopy(payload) {
  const materialSummary = (payload.materials || []).map((item, index) => `${index + 1}. ${item.name || item.file_path}`).join("\n");
  if (!payload.apiKey) {
    return { ok: true, provider: "fallback", post: fallbackPost({ ...payload, topic: payload.topic || "口腔图文发布" }) };
  }

  const prompt = [
    "请只输出 JSON，不要 Markdown。",
    "JSON 字段：title, body, hashtags, cover_index, image_order, schedule_suggestion, publish_fields。",
    "你正在为抖音创作者中心的图文发布准备文字信息，需要：标题、正文、话题标签、首图建议、图片顺序建议、定时发布建议。",
    "抖音图文常用文字项包括：作品标题、作品描述/正文、话题标签、位置、可见性、定时发布等；这里只生成文字和配置建议。",
    "必须合规：不承诺疗效，不写最低价诱导，不夸大治疗效果。",
    `选题：${payload.topic || ""}`,
    `项目：${payload.project || ""}`,
    `引流关键词：${payload.leadKeyword || "预约"}`,
    `素材列表：\n${materialSummary}`
  ].join("\n");

  const content = await callDeepSeek(payload, prompt);
  return { ok: true, provider: "deepseek", post: extractJson(content) };
}

function createTasks(payload) {
  ensureDir(TASK_ROOT);
  const materials = payload.materials || [];
  const imagesPerPost = Math.max(1, Math.min(Number(payload.imagesPerPost || 3), 18));
  const startAt = payload.startAt ? new Date(payload.startAt) : new Date();
  const intervalMinutes = Math.max(1, Number(payload.intervalMinutes || 60));
  const chunks = [];

  for (let index = 0; index < materials.length; index += imagesPerPost) {
    chunks.push(materials.slice(index, index + imagesPerPost));
  }

  const tasks = chunks.map((images, index) => {
    const scheduledAt = new Date(startAt.getTime() + index * intervalMinutes * 60000).toISOString();
    return {
      task_id: contentId("publish-task"),
      platform: payload.platform || "douyin",
      publish_type: "image_text",
      status: "scheduled",
      scheduled_at: scheduledAt,
      images_per_post: imagesPerPost,
      images,
      title: payload.title,
      body: payload.body,
      hashtags: payload.hashtags || [],
      lead_keyword: payload.leadKeyword || "预约",
      created_at: new Date().toISOString()
    };
  });

  const taskPath = path.join(TASK_ROOT, `${contentId("task-batch")}.json`);
  fs.writeFileSync(taskPath, JSON.stringify({ ok: true, tasks }, null, 2), "utf8");
  return { ok: true, task_path: taskPath, count: tasks.length, tasks };
}

function packagePost(payload) {
  ensureDir(OUTPUT_DIR);
  const id = payload.contentId || contentId();
  const record = {
    ok: true,
    content_id: id,
    platform: payload.platform || "douyin",
    publish_type: "image_text",
    status: payload.mode === "real_publish" ? "ready_for_publisher_adapter" : "packaged",
    title: payload.title,
    body: payload.body,
    hashtags: payload.hashtags || [],
    images: payload.images || payload.localImages || payload.aiImages || [],
    image_prompt: payload.imagePrompt || "",
    lead_router: {
      lead_needed: true,
      lead_type: "comment_or_dm_keyword",
      source_platform: payload.platform || "douyin",
      keyword: payload.leadKeyword || "预约"
    },
    created_at: new Date().toISOString()
  };
  const outputPath = path.join(OUTPUT_DIR, `${id}.image-text.json`);
  fs.writeFileSync(outputPath, JSON.stringify(record, null, 2), "utf8");
  return { ...record, output_path: outputPath };
}

async function main() {
  const [command, rawPayload] = process.argv.slice(2);
  const payload = rawPayload ? JSON.parse(rawPayload) : {};

  let result;
  if (command === "generate-prompt" || command === "generate-post") {
    result = await generatePrompt(payload);
  } else if (command === "generate-images") {
    result = await generateImages(payload);
  } else if (command === "list-materials") {
    result = listMaterials(payload);
  } else if (command === "generate-copy") {
    result = await generateCopy(payload);
  } else if (command === "create-tasks") {
    result = createTasks(payload);
  } else if (command === "package-post" || command === "publish") {
    result = packagePost(payload);
  } else {
    throw new Error("Usage: node scripts/douyin_post_cli.js <generate-prompt|generate-images|list-materials|generate-copy|create-tasks|package-post> [payloadJson]");
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  generatePrompt,
  generateImages,
  listMaterials,
  generateCopy,
  createTasks,
  packagePost
};
