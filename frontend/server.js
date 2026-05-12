"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname);
const projectRoot = path.resolve(__dirname, "..");
const generatedImageRoot = path.join(projectRoot, "outputs", "content", "generated-images");
const port = 3030;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

function runNodeScript(scriptPath, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Script exited with code ${code}`));
        return;
      }
      try {
        resolve(stdout.trim() ? JSON.parse(stdout) : { ok: true });
      } catch {
        resolve({ ok: true, stdout });
      }
    });
  });
}

async function handleApi(request, response) {
  try {
    if (request.method === "GET" && request.url === "/api/douyin/login/status") {
      const statePath = path.join(projectRoot, "secrets", "douyin_storage_state.json");
      sendJson(response, 200, {
        ok: true,
        loggedIn: fs.existsSync(statePath),
        storageStatePath: statePath
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/dm/read") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_dm_cli.js"), [
        "read",
        JSON.stringify({ limit: Number(body.limit || 20) })
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/reply/generate") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_dm_cli.js"), [
        "generate",
        JSON.stringify({
          message: body.message,
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          model: body.model,
          knowledgeText: body.knowledgeText
        })
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/dm/send") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_dm_cli.js"), [
        "send",
        JSON.stringify({
          nickname: body.nickname,
          threadText: body.threadText,
          replyText: body.replyText
        })
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/generate") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "generate-prompt",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/image-generate") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "generate-images",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/materials") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "list-materials",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/copy") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "generate-copy",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/tasks") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "create-tasks",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/douyin/post/package") {
      const body = await readJsonBody(request);
      const result = await runNodeScript(path.join(projectRoot, "scripts", "douyin_post_cli.js"), [
        "package-post",
        JSON.stringify(body)
      ]);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.url.startsWith("/api/")) {
      handleApi(request, response);
      return;
    }

    if (request.url.startsWith("/generated-images/")) {
      const relativePath = decodeURIComponent(request.url.replace(/^\/generated-images\//, ""));
      const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(generatedImageRoot, safePath);
      if (!filePath.startsWith(generatedImageRoot)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      fs.readFile(filePath, (error, buffer) => {
        if (error) {
          response.writeHead(404);
          response.end("Not Found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream"
        });
        response.end(buffer);
      });
      return;
    }

    const requestPath = request.url === "/" ? "/index.html" : request.url;
    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, buffer) => {
      if (error) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream"
      });
      response.end(buffer);
    });
  });
}

function startServer(listenPort = port) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, () => {
      console.log(`Frontend ready at http://localhost:${listenPort}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createServer,
  startServer
};
