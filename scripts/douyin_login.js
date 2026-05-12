"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findChromeExecutable } = require("./chrome_path");

const AGENT_ROOT = "C:\\Users\\G2002\\Desktop\\\u65b0\u5efa\u6587\u4ef6\u5939\\douyin-auto-agent";
const CHAT_URL = "https://creator.douyin.com/creator-micro/data/following/chat";
const STORAGE_STATE_PATH = path.resolve(__dirname, "..", "secrets", "douyin_storage_state.json");

function requirePlaywright() {
  return require(path.join(AGENT_ROOT, "node_modules", "playwright"));
}

async function main() {
  const playwright = requirePlaywright();
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const executablePath = findChromeExecutable();
  const browser = await playwright.chromium.launch({
    headless: false,
    executablePath: executablePath || undefined,
    args: ["--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  console.log("Please finish Douyin login in the opened browser.");
  console.log("When the chat page is visible, this script will save login state automatically.");

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    const url = page.url();
    const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    const looksLoggedIn =
      url.includes("/creator-micro/data/following/chat") &&
      !/扫码|验证码|登录|请先登录/.test(bodyText) &&
      /私信|消息|聊天|粉丝|会话/.test(bodyText);

    if (looksLoggedIn) {
      break;
    }

    if (!url.includes("/creator-micro/data/following/chat")) {
      await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    }
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
  console.log(`Login state saved: ${STORAGE_STATE_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
