"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findChromeExecutable } = require("./chrome_path");

const AGENT_ROOT = "C:\\Users\\G2002\\Desktop\\新建文件夹\\douyin-auto-agent";
const CHAT_URL = "https://creator.douyin.com/creator-micro/data/following/chat";
const STORAGE_STATE_PATH = path.resolve(__dirname, "..", "secrets", "douyin_storage_state.json");
const OUTPUT_DIR = path.resolve(__dirname, "..", "outputs", "douyin_dm");
const MESSAGE_CACHE_PATH = path.join(OUTPUT_DIR, "messages.json");

function requirePlaywright() {
  return require(path.join(AGENT_ROOT, "node_modules", "playwright"));
}

function ensureReady() {
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    throw new Error(`Missing Douyin login state: ${STORAGE_STATE_PATH}. Run scripts/douyin_login.js first.`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashCode(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function newPage(headless = true) {
  ensureReady();
  const playwright = requirePlaywright();
  const executablePath = findChromeExecutable();
  const browser = await playwright.chromium.launch({
    headless,
    executablePath: executablePath || undefined,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { browser, page };
}

async function closePopups(page) {
  const selectors = [
    'button:has-text("知道了")',
    'button:has-text("我知道了")',
    'button:has-text("跳过")',
    '[aria-label="关闭"]',
    '[class*="close"]'
  ];

  for (const selector of selectors) {
    try {
      const node = page.locator(selector).first();
      if (await node.isVisible({ timeout: 600 })) {
        await node.click({ force: true });
      }
    } catch {
      // Ignore optional popups.
    }
  }
}

function splitBodyLines(bodyText) {
  return String(bodyText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferIntent(text) {
  if (/矫正|牙套|龅牙|牙齿不齐/.test(text)) return "矫正咨询";
  if (/种植|缺牙|种牙/.test(text)) return "种植咨询";
  if (/洗牙|牙结石/.test(text)) return "洗牙咨询";
  if (/补牙|蛀牙|虫牙/.test(text)) return "补牙咨询";
  if (/美白|黄牙/.test(text)) return "美白咨询";
  return "普通咨询";
}

function parseMessagesFromLines(lines, limit) {
  const startIndex = lines.findIndex((line) => line === "全选");
  const endIndex = lines.findIndex((line) => line.includes("没有更多"));
  const relevant = lines.slice(startIndex >= 0 ? startIndex + 1 : 0, endIndex >= 0 ? endIndex : lines.length);
  const isUnreadCount = (line) => /^\d+$/.test(line);
  const isTimeLine = (line) => /^\d{1,2}:\d{2}$/.test(line) || /^(刚刚|今天|昨天|前天)$/.test(line);

  const messages = [];
  let index = 0;

  while (index < relevant.length) {
    let unreadCount = 0;
    if (isUnreadCount(relevant[index])) {
      unreadCount = Number(relevant[index]);
      index += 1;
    }

    const nickname = normalizeText(relevant[index] || "");
    const content = normalizeText(relevant[index + 1] || "");
    const time = normalizeText(relevant[index + 2] || "");

    if (!nickname || !content || !isTimeLine(time)) {
      index += 1;
      continue;
    }

    const messageKey = `${nickname}|${time}|${content}`;
    messages.push({
      id: `dy-${hashCode(messageKey)}`,
      status: unreadCount > 0 ? "unread" : "read",
      unreadCount,
      nickname,
      time,
      intent: inferIntent(content),
      content,
      threadText: nickname,
      draft: "",
      finalReply: "",
      source: "douyin_web",
      capturedAt: new Date().toISOString()
    });

    index += 3;
  }

  return messages.slice(0, limit);
}

async function readMessages(limit = 20) {
  const { browser, page } = await newPage(true);
  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(5000);
    await closePopups(page);

    const bodyText = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
    const lines = splitBodyLines(bodyText);
    const messages = parseMessagesFromLines(lines, limit);

    fs.writeFileSync(path.join(OUTPUT_DIR, "last_body_text.txt"), bodyText, "utf8");
    fs.writeFileSync(path.join(OUTPUT_DIR, "last_body_lines.json"), JSON.stringify(lines, null, 2), "utf8");
    fs.writeFileSync(MESSAGE_CACHE_PATH, JSON.stringify(messages, null, 2), "utf8");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "last_inbox.png"), fullPage: true }).catch(() => {});

    if (/登录|扫码|验证码|请先登录/.test(bodyText) && !/私信|消息|聊天/.test(bodyText)) {
      throw new Error("Douyin appears to require login or verification. Please refresh login state.");
    }

    return { ok: true, count: messages.length, messages, debugDir: OUTPUT_DIR };
  } finally {
    await browser.close();
  }
}

async function generateReply({ message, apiKey, baseUrl, model, knowledgeText }) {
  if (!apiKey) throw new Error("Missing apiKey for reply generation.");

  const endpoint = `${String(baseUrl || "https://api.deepseek.com").replace(/\/+$/, "")}/chat/completions`;
  const prompt = [
    "你是口腔门店抖音私信客服，只输出可以直接发给客户的一段中文回复。",
    "要求：礼貌、简短、不承诺疗效；涉及价格只给区间或引导到店检查；优先引导加企微或预约。",
    `客户意图：${message.intent || ""}`,
    `客户私信：${message.content || message.threadText || ""}`,
    knowledgeText ? `资料/SOP：${String(knowledgeText).slice(0, 3000)}` : ""
  ].filter(Boolean).join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      temperature: 0.4,
      messages: [
        { role: "system", content: "你是专业口腔门店私信客服。" },
        { role: "user", content: prompt }
      ]
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text);
  return String(json?.choices?.[0]?.message?.content || "").trim();
}

function extractNickname(threadText, explicitNickname = "") {
  const cleanedExplicit = normalizeText(explicitNickname);
  if (cleanedExplicit) return cleanedExplicit;

  const cleaned = normalizeText(threadText);
  if (!cleaned) return "";

  const cachedMessages = fs.existsSync(MESSAGE_CACHE_PATH)
    ? JSON.parse(fs.readFileSync(MESSAGE_CACHE_PATH, "utf8"))
    : [];
  const cachedMatch = Array.isArray(cachedMessages)
    ? cachedMessages.find((message) => normalizeText(message.threadText) === cleaned)
    : null;

  if (cachedMatch?.nickname) {
    return normalizeText(cachedMatch.nickname);
  }

  return cleaned.split(" ")[0] || "";
}

async function tryOpenConversation(page, { nickname, threadText }) {
  const cleanedNickname = normalizeText(nickname);
  const cleanedThread = normalizeText(threadText);
  const attempts = [];

  if (cleanedNickname) {
    attempts.push({
      label: `nickname:${cleanedNickname}`,
      locator: page.getByText(cleanedNickname, { exact: false }).first()
    });
    attempts.push({
      label: `nickname-regex:${cleanedNickname}`,
      locator: page.locator(`text=/${escapeRegExp(cleanedNickname)}/i`).first()
    });
  }

  if (cleanedThread) {
    attempts.push({
      label: `thread:${cleanedThread.slice(0, 24)}`,
      locator: page.getByText(cleanedThread.slice(0, 24), { exact: false }).first()
    });
  }

  const failures = [];

  for (const attempt of attempts) {
    try {
      await attempt.locator.click({ timeout: 5000, force: true });
      await page.waitForTimeout(1200);
      return { opened: true, strategy: attempt.label };
    } catch (error) {
      failures.push(`${attempt.label} -> ${error.message}`);
    }
  }

  return { opened: false, strategy: "", failures };
}

async function sendReply({ threadText, replyText, nickname }) {
  if (!replyText) throw new Error("Missing replyText.");

  const { browser, page } = await newPage(true);
  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(4000);
    await closePopups(page);

    const targetNickname = extractNickname(threadText, nickname);
    const openResult = await tryOpenConversation(page, {
      nickname: targetNickname,
      threadText
    });

    if (!openResult.opened) {
      throw new Error(`Conversation not found for "${targetNickname || threadText}". ${openResult.failures?.join(" | ") || ""}`.trim());
    }

    const editorSelectors = [
      "textarea",
      '[contenteditable="true"]',
      'div[role="textbox"]',
      'input[type="text"]'
    ];

    let editor = null;
    for (const selector of editorSelectors) {
      const node = page.locator(selector).last();
      try {
        if (await node.isVisible({ timeout: 1200 })) {
          editor = node;
          break;
        }
      } catch {
        // Try next selector.
      }
    }

    if (!editor) {
      throw new Error(`Reply editor not found after opening "${targetNickname}".`);
    }

    await editor.click({ force: true });
    await page.keyboard.type(replyText, { delay: 8 });

    const sendSelectors = [
      'button:has-text("发送")',
      'span:has-text("发送")',
      'div[role="button"]:has-text("发送")'
    ];

    let clicked = false;
    for (const selector of sendSelectors) {
      const node = page.locator(selector).last();
      try {
        if (await node.isVisible({ timeout: 1200 })) {
          await node.click({ force: true });
          clicked = true;
          break;
        }
      } catch {
        // Try next selector.
      }
    }

    if (!clicked) {
      throw new Error(`Send button not found for "${targetNickname}".`);
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "last_send.png"), fullPage: true }).catch(() => {});
    return {
      ok: true,
      sentAt: new Date().toISOString(),
      nickname: targetNickname,
      openStrategy: openResult.strategy
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const [command, payloadRaw] = process.argv.slice(2);
  let payload = {};

  if (payloadRaw) {
    if (payloadRaw.startsWith("--limit=")) {
      payload = { limit: Number(payloadRaw.slice("--limit=".length)) };
    } else {
      payload = JSON.parse(payloadRaw);
    }
  }

  let result;
  if (command === "read") {
    result = await readMessages(Number(payload.limit || 20));
  } else if (command === "generate") {
    result = { ok: true, reply: await generateReply(payload) };
  } else if (command === "send") {
    result = await sendReply(payload);
  } else {
    throw new Error("Usage: node scripts/douyin_dm_cli.js <read|generate|send> [payloadJson]");
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
  readMessages,
  generateReply,
  sendReply
};
