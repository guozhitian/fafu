from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_RETRIEVER_SRC = Path("D:/MEME-/gz/knowledge-retriever/src")
REPLY_DRAFTER_SRC = Path("D:/MEME-/gz/reply-drafter/src")

sys.path.insert(0, str(KNOWLEDGE_RETRIEVER_SRC))
sys.path.insert(0, str(REPLY_DRAFTER_SRC))

from knowledge_retriever import retrieve_knowledge  # type: ignore  # noqa: E402
from reply_drafter import run_reply_drafter  # type: ignore  # noqa: E402


def read_json(file_path: Path) -> Any:
    return json.loads(file_path.read_text(encoding="utf-8"))


def getenv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped if stripped else default


def load_dotenv(file_path: Path) -> None:
    if not file_path.exists():
        return
    for line in file_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


def ensure_dir(dir_path: Path) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)


def infer_intent(session_context: str) -> str:
    text = session_context.lower()
    rules = [
        (("\u9000\u6b3e", "refund"), "\u5b89\u629a\u5ba2\u6237\u5e76\u8bf4\u660e\u9000\u6b3e\u5904\u7406\u65f6\u6548"),
        (("\u53d1\u8d27", "\u7269\u6d41", "shipping", "delivery", "logistics"), "\u8bf4\u660e\u53d1\u8d27\u65f6\u6548\u5e76\u5f15\u5bfc\u8010\u5fc3\u7b49\u5f85"),
        (("\u4ef7\u683c", "\u4f18\u60e0", "price", "discount", "plan"), "\u4ecb\u7ecd\u65b9\u6848\u4eae\u70b9\u5e76\u63a8\u52a8\u8fdb\u4e00\u6b65\u54a8\u8be2"),
        (("\u552e\u540e", "\u7ef4\u4fee", "after-sales", "repair", "support"), "\u8bf4\u660e\u552e\u540e\u6d41\u7a0b\u5e76\u7ed9\u51fa\u4e0b\u4e00\u6b65"),
    ]
    for keywords, intent in rules:
        if any(keyword in text for keyword in keywords):
            return intent
    return "\u4e13\u4e1a\u56de\u7b54\u5ba2\u6237\u95ee\u9898\u5e76\u5f15\u5bfc\u4e0b\u4e00\u6b65\u6c9f\u901a"


def normalize_knowledge_base(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and isinstance(raw.get("items"), list):
        return {"items": raw["items"]}
    if isinstance(raw, list):
        return {"items": raw}
    raise ValueError("knowledge_base must be a list or an object with items.")


def build_business_reply(reply_text: str) -> str:
    return (
        "\u60a8\u597d\uff0c\u611f\u8c22\u60a8\u7684\u54a8\u8be2\u3002"
        + reply_text
        + "\u5982\u9700\u8fdb\u4e00\u6b65\u5904\u7406\uff0c\u6211\u4eec\u4e5f\u53ef\u4ee5\u7ee7\u7eed\u534f\u52a9\u60a8\u5b8c\u6210\u540e\u7eed\u6b65\u9aa4\u3002"
    )


def append_jsonl(file_path: Path, payload: dict[str, Any]) -> None:
    with file_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def post_json(url: str, payload: dict[str, Any], bearer_token: str | None = None) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {bearer_token}"} if bearer_token else {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {"status": response.status}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body}") from exc


def send_reply(transcript: dict[str, Any]) -> dict[str, Any]:
    mode = (getenv("REPLY_SEND_MODE", "local") or "local").lower()
    if mode == "local":
        return {"delivery_status": "sent", "provider": "local"}
    if mode == "webhook":
        webhook_url = getenv("REPLY_WEBHOOK_URL")
        if not webhook_url:
            raise RuntimeError("Missing REPLY_WEBHOOK_URL for webhook send mode.")
        response = post_json(webhook_url, transcript, getenv("REPLY_WEBHOOK_BEARER_TOKEN"))
        return {"delivery_status": "sent", "provider": "webhook", "response": response}
    if mode == "wecom_bot":
        webhook_url = getenv("WECOM_BOT_WEBHOOK")
        if not webhook_url:
            raise RuntimeError("Missing WECOM_BOT_WEBHOOK for wecom_bot mode.")
        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": (
                    f"**Session:** {transcript['session_id']}\n"
                    f"**Intent:** {transcript['intent']}\n"
                    f"**Customer:** {transcript['customer_message']}\n"
                    f"**Reply:** {transcript['reply_text']}"
                )
            },
        }
        response = post_json(webhook_url, payload)
        return {"delivery_status": "sent", "provider": "wecom_bot", "response": response}
    raise RuntimeError(f"Unsupported REPLY_SEND_MODE: {mode}")


def log_reply(transcript: dict[str, Any]) -> dict[str, Any] | None:
    webhook_url = getenv("REPLY_LOG_WEBHOOK_URL")
    if not webhook_url:
        return None
    response = post_json(webhook_url, transcript, getenv("REPLY_LOG_BEARER_TOKEN"))
    return {"provider": "reply_log_webhook", "response": response}


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python workflows/reply_workflow.py <job.json>")

    load_dotenv(ROOT / ".env")
    job_path = Path(sys.argv[1]).resolve()
    job = read_json(job_path)
    output_dir = Path(job["output_dir"]).resolve()
    ensure_dir(output_dir)

    session_context = str(job["session_context"]).strip()
    intent = str(job.get("intent") or infer_intent(session_context)).strip()
    session_id = str(job.get("session_id") or f"session-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}")
    knowledge_base = normalize_knowledge_base(read_json(Path(job["knowledge_base_path"]).resolve()))

    retrieval_result = retrieve_knowledge(
        {
            "session_context": session_context,
            "knowledge_base": knowledge_base,
        }
    )
    if not retrieval_result["success"]:
        raise RuntimeError(f"Knowledge retrieval failed: {retrieval_result['error']}")

    retrieved_items = retrieval_result["data"]["retrieved_knowledge"]
    drafter_result = run_reply_drafter(
        {
            "session_context": session_context,
            "intent": intent,
            "retrieved_knowledge": retrieved_items,
        }
    )
    if "error" in drafter_result:
        raise RuntimeError(f"Reply drafting failed: {drafter_result['error']}")

    final_reply = build_business_reply(drafter_result["reply_text"])
    sent_at = datetime.now(timezone.utc).isoformat()
    transcript = {
        "session_id": session_id,
        "customer_message": session_context,
        "intent": intent,
        "retrieved_knowledge": retrieved_items,
        "reply_text": final_reply,
        "sent_at": sent_at,
    }
    delivery_result = send_reply(transcript)
    transcript["delivery_status"] = delivery_result["delivery_status"]
    transcript["delivery_provider"] = delivery_result["provider"]
    if "response" in delivery_result:
        transcript["delivery_response"] = delivery_result["response"]
    log_result = log_reply(transcript)
    if log_result is not None:
        transcript["log_result"] = log_result

    append_jsonl(output_dir / "sent_messages.jsonl", transcript)
    (output_dir / f"{session_id}.json").write_text(json.dumps(transcript, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"success": True, "data": transcript}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
