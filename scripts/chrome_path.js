"use strict";

const fs = require("node:fs");

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

function findChromeExecutable() {
  return CANDIDATES.find((candidate) => fs.existsSync(candidate)) || "";
}

module.exports = {
  findChromeExecutable
};
