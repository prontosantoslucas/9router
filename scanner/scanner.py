#!/usr/bin/env python3
"""
API-key leak scanner (DEFENSIVE).

Scans PUBLIC sources for accidentally-committed API keys, validates each one,
checks whether it holds real spendable balance, and writes result.txt.

Purpose: notify repo/paste owners whose PAID keys with actual balance are
exposed. Free-tier keys and empty ($0) paid keys are reported for reference but
flagged "not worth notifying" — there is no financial harm to the owner.

Sources are official APIs / public dumps ONLY. This tool deliberately does NOT:
  - dork search engines (Google/Bing `filetype:env`)          -> ToS violation
  - crawl or probe arbitrary web hosts for exposed .env files  -> unauthorized access
  - brute-force paths / fish for open directories
Covered sources:
  - GitHub code search + Gists   (GITHUB_TOKEN required for search)
  - GitLab blob search           (GITLAB_TOKEN optional)
  - Pastebin scraping API        (Pro account; PASTEBIN_API_SCRAPE=1 to enable)

Usage:
  pip install requests
  export GITHUB_TOKEN=ghp_xxx
  python scanner/scanner.py                      # all sources, all providers
  python scanner/scanner.py --providers openai anthropic
  python scanner/scanner.py --sources github gitlab
  python scanner/scanner.py --out result.txt --max-queries 40
"""

import os
import re
import sys
import json
import time
import argparse
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")


TIMEOUT = 10

# ── Provider definitions ──────────────────────────────────────────────────
# Each provider: name, tier (paid/free), patterns[], validate(key)->status,
# and optionally check_balance(key)->dict. Mirrors src/lib/scanner/scanner.js.


def _openai_validate(key):
    r = requests.get("https://api.openai.com/v1/models",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    if r.status_code == 200:
        return "valid"
    if r.status_code == 401:
        return "invalid"
    if r.status_code == 429:
        body = _json(r)
        if (body.get("error") or {}).get("code") == "insufficient_quota":
            return "valid_no_balance"
        return "rate_limited"
    return "error"


def _openai_balance(key):
    r = requests.post("https://api.openai.com/v1/chat/completions",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"model": "gpt-4o-mini", "max_tokens": 1,
                            "messages": [{"role": "user", "content": "hi"}]},
                      timeout=TIMEOUT)
    if r.status_code == 200:
        return {"hasBalance": True, "source": "completion_ok"}
    if r.status_code == 429:
        body = _json(r)
        if (body.get("error") or {}).get("code") == "insufficient_quota":
            return {"hasBalance": False, "source": "insufficient_quota"}
        return {"hasBalance": None, "source": "rate_limited"}
    return {"hasBalance": None, "source": f"http_{r.status_code}"}


def _anthropic_validate(key):
    r = requests.get("https://api.anthropic.com/v1/models",
                     headers={"x-api-key": key, "anthropic-version": "2023-06-01"}, timeout=TIMEOUT)
    if r.status_code == 200:
        return "valid"
    if r.status_code in (401, 403):
        return "invalid"
    if r.status_code == 429:
        return "rate_limited"
    return "error"


def _anthropic_balance(key):
    r = requests.post("https://api.anthropic.com/v1/messages",
                      headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                               "Content-Type": "application/json"},
                      json={"model": "claude-3-5-haiku-20241022", "max_tokens": 1,
                            "messages": [{"role": "user", "content": "hi"}]},
                      timeout=TIMEOUT)
    if r.status_code == 200:
        return {"hasBalance": True, "source": "message_ok"}
    if r.status_code == 400:
        msg = ((_json(r).get("error") or {}).get("message") or "").lower()
        if "credit balance" in msg:
            return {"hasBalance": False, "source": "credit_balance_too_low"}
        return {"hasBalance": True, "source": "message_400_but_authed"}
    if r.status_code == 429:
        return {"hasBalance": None, "source": "rate_limited"}
    return {"hasBalance": None, "source": f"http_{r.status_code}"}


def _deepseek_validate(key):
    r = requests.get("https://api.deepseek.com/v1/models",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid", 429: "rate_limited"}.get(r.status_code, "error")


def _deepseek_balance(key):
    r = requests.get("https://api.deepseek.com/user/balance",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    if r.status_code != 200:
        return {"hasBalance": None, "source": f"http_{r.status_code}"}
    info = (_json(r).get("balance_infos") or [{}])[0]
    total = float(info.get("total_balance") or 0)
    return {"hasBalance": total > 0, "amountUsd": total,
            "currency": info.get("currency"), "source": "user_balance"}


def _openrouter_validate(key):
    r = requests.get("https://openrouter.ai/api/v1/auth/key",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid", 429: "rate_limited"}.get(r.status_code, "error")


def _openrouter_balance(key):
    r = requests.get("https://openrouter.ai/api/v1/auth/key",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    if r.status_code != 200:
        return {"hasBalance": None, "source": f"http_{r.status_code}"}
    info = _json(r).get("data") or {}
    usage = float(info.get("usage") or 0)
    limit = info.get("limit")
    if info.get("is_free_tier"):
        return {"hasBalance": False, "isFreeTier": True, "usage": usage, "source": "auth_key"}
    if limit is None:
        return {"hasBalance": True, "amountUsd": None, "usage": usage, "source": "auth_key_unbounded"}
    remaining = float(limit) - usage
    return {"hasBalance": remaining > 0, "amountUsd": remaining, "usage": usage,
            "limit": float(limit), "source": "auth_key"}


def _replicate_validate(key):
    r = requests.get("https://api.replicate.com/v1/account",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid"}.get(r.status_code, "error")


def _replicate_balance(key):
    r = requests.get("https://api.replicate.com/v1/account",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    if r.status_code != 200:
        return {"hasBalance": None, "source": f"http_{r.status_code}"}
    typ = str(_json(r).get("type") or "").lower()
    is_free = typ in ("", "free")
    return {"hasBalance": not is_free, "accountType": typ or "unknown", "source": "account"}


def _elevenlabs_validate(key):
    r = requests.get("https://api.elevenlabs.io/v1/user/subscription",
                     headers={"xi-api-key": key}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid"}.get(r.status_code, "error")


def _elevenlabs_balance(key):
    r = requests.get("https://api.elevenlabs.io/v1/user/subscription",
                     headers={"xi-api-key": key}, timeout=TIMEOUT)
    if r.status_code != 200:
        return {"hasBalance": None, "source": f"http_{r.status_code}"}
    tier = str(_json(r).get("tier") or "").lower()
    is_free = tier in ("", "free", "trial")
    return {"hasBalance": not is_free, "tier": tier or "unknown", "source": "subscription"}


def _perplexity_validate(key):
    r = requests.post("https://api.perplexity.ai/chat/completions",
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"model": "sonar", "max_tokens": 1,
                            "messages": [{"role": "user", "content": "hi"}]},
                      timeout=TIMEOUT)
    return {200: "valid", 401: "invalid", 402: "valid_no_balance",
            429: "rate_limited"}.get(r.status_code, "error")


def _simple_validate(url, auth_header="bearer"):
    def _v(key):
        if auth_header == "bearer":
            h = {"Authorization": f"Bearer {key}"}
        else:
            h = {auth_header: key}
        r = requests.get(url, headers=h, timeout=TIMEOUT)
        return {200: "valid", 401: "invalid", 429: "rate_limited"}.get(r.status_code, "error")
    return _v


def _groq_validate(key):
    # Groq mounts the OpenAI-compatible API under /openai/v1, not /v1.
    r = requests.get("https://api.groq.com/openai/v1/models",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid", 429: "rate_limited"}.get(r.status_code, "error")


def _google_validate(key):
    # models list endpoint is auth-only and doesn't burn quota.
    r = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
                     timeout=TIMEOUT)
    if r.status_code == 200:
        return "valid"
    if r.status_code in (400, 403):
        return "invalid"
    if r.status_code == 429:
        return "rate_limited"
    return "error"


def _hf_validate(key):
    r = requests.get("https://huggingface.co/api/whoami-v2",
                     headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT)
    return {200: "valid", 401: "invalid"}.get(r.status_code, "error")


PROVIDERS = {
    "openai": {
        "name": "OpenAI", "tier": "paid",
        "patterns": [
            re.compile(r"sk-proj-[A-Za-z0-9\-_]{74}T3BlbkFJ[A-Za-z0-9\-_]{73}A"),
            re.compile(r"sk-svcacct-[A-Za-z0-9\-_]{74}T3BlbkFJ[A-Za-z0-9\-_]{73}A"),
            re.compile(r"sk-proj-[A-Za-z0-9\-_]{58}T3BlbkFJ[A-Za-z0-9\-_]{58}"),
            re.compile(r"sk-proj-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}"),
        ],
        "validate": _openai_validate, "check_balance": _openai_balance,
        "search_tokens": ["sk-proj-", "sk-svcacct-"],
    },
    "anthropic": {
        "name": "Anthropic", "tier": "paid",
        "patterns": [re.compile(r"sk-ant-[A-Za-z0-9\-_]{32,100}")],
        "validate": _anthropic_validate, "check_balance": _anthropic_balance,
        "search_tokens": ["sk-ant-"],
    },
    "deepseek": {
        "name": "DeepSeek", "tier": "paid",
        "patterns": [re.compile(r"sk-[a-f0-9]{32}(?![a-f0-9])")],
        "validate": _deepseek_validate, "check_balance": _deepseek_balance,
        "search_tokens": ["sk-"],
    },
    "openrouter": {
        "name": "OpenRouter", "tier": "paid",
        "patterns": [re.compile(r"sk-or-v1-[A-Za-z0-9]{40,100}"), re.compile(r"sk-or-[A-Za-z0-9]{40,80}")],
        "validate": _openrouter_validate, "check_balance": _openrouter_balance,
        "search_tokens": ["sk-or-"],
    },
    "perplexity": {
        "name": "Perplexity", "tier": "paid",
        "patterns": [re.compile(r"pplx-[A-Za-z0-9\-_]{32,100}")],
        "validate": _perplexity_validate, "check_balance": None,
        "search_tokens": ["pplx-"],
    },
    "replicate": {
        "name": "Replicate", "tier": "paid",
        "patterns": [re.compile(r"r8_[A-Za-z0-9]{30,60}")],
        "validate": _replicate_validate, "check_balance": _replicate_balance,
        "search_tokens": ["r8_"],
    },
    "elevenlabs": {
        "name": "ElevenLabs", "tier": "paid",
        "patterns": [re.compile(r"eleven-[A-Za-z0-9]{30,60}")],
        "validate": _elevenlabs_validate, "check_balance": _elevenlabs_balance,
        "search_tokens": ["eleven-"],
    },
    "cohere": {
        "name": "Cohere", "tier": "paid",
        "patterns": [re.compile(r"co-[A-Za-z0-9]{30,60}")],
        "validate": _simple_validate("https://api.cohere.com/v1/models"), "check_balance": None,
        "search_tokens": ["co-"],
    },
    "together": {
        "name": "Together AI", "tier": "paid",
        "patterns": [re.compile(r"tgp-[A-Za-z0-9]{30,60}")],
        "validate": _simple_validate("https://api.together.xyz/v1/models"), "check_balance": None,
        "search_tokens": ["tgp-"],
    },
    "mistral": {
        "name": "Mistral", "tier": "paid",
        "patterns": [re.compile(r"mistral_[A-Za-z0-9]{30,50}"), re.compile(r"mi_[A-Za-z0-9]{30,50}")],
        "validate": _simple_validate("https://api.mistral.ai/v1/models"), "check_balance": None,
        "search_tokens": ["mistral_"],
    },
    "groq": {
        "name": "Groq", "tier": "free",
        "patterns": [re.compile(r"gsk_[A-Za-z0-9]{40,60}")],
        "validate": _groq_validate, "check_balance": None,
        "search_tokens": ["gsk_"],
    },
    "google": {
        "name": "Google Gemini", "tier": "free",
        "patterns": [re.compile(r"AIzaSy[A-Za-z0-9_\-]{26,40}")],
        "validate": _google_validate, "check_balance": None,
        "search_tokens": ["AIzaSy"],
    },
    "huggingface": {
        "name": "HuggingFace", "tier": "free",
        "patterns": [re.compile(r"hf_[A-Za-z0-9]{20,60}")],
        "validate": _hf_validate, "check_balance": None,
        "search_tokens": ["hf_"],
    },
}


# ── Helpers ────────────────────────────────────────────────────────────────
def _json(resp):
    try:
        return resp.json()
    except Exception:
        return {}


def match_keys(text, providers):
    out = []
    for p in providers:
        cfg = PROVIDERS.get(p)
        if not cfg:
            continue
        for pat in cfg["patterns"]:
            for m in set(pat.findall(text)):
                out.append((m, p))
    return out


def validate_key(key, provider):
    cfg = PROVIDERS.get(provider)
    if not cfg or not cfg.get("validate"):
        return "unknown"
    try:
        return cfg["validate"](key)
    except Exception:
        return "error"


def check_balance(key, provider):
    cfg = PROVIDERS.get(provider)
    if not cfg or not cfg.get("check_balance"):
        return {"hasBalance": None, "source": "no_balance_endpoint"}
    try:
        return cfg["check_balance"](key)
    except Exception as e:
        return {"hasBalance": None, "source": "error", "error": str(e)}


def is_worth_notifying(provider, status, balance):
    """Signal = real financial exposure, not merely 'valid'."""
    cfg = PROVIDERS.get(provider)
    if not cfg or cfg.get("tier") != "paid":
        return False
    if status not in ("valid", "rate_limited"):
        return False
    if balance and balance.get("hasBalance") is False:
        return False
    return True


# ── Sources ──────────────────────────────────────────────────────────────
def _gh_headers():
    t = os.environ.get("GITHUB_SCANNER_TOKEN") or os.environ.get("GITHUB_TOKEN")
    return {"Authorization": f"token {t}"} if t else {}


def _gh_get(url):
    try:
        r = requests.get(url, headers=_gh_headers(), timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None


def _raw_url(owner, repo, branch, path):
    enc = "/".join(requests.utils.quote(p) for p in path.split("/"))
    return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{enc}"


def _fetch_raw(url):
    try:
        r = requests.get(url, timeout=8)
        return r.text if r.ok else None
    except Exception:
        return None


def scan_github(providers, max_queries, log):
    found = {}
    if not (_gh_headers()):
        log("github: no GITHUB_TOKEN set — code search disabled, skipping")
        return found

    queries = []
    for p in providers:
        cfg = PROVIDERS.get(p)
        if not cfg:
            continue
        for tok in cfg["search_tokens"]:
            queries += [
                f'"{tok}" path:.env NOT .env.example',
                f'"{tok}" language:dotenv',
                f'"{tok}" path:.json',
                f'"{tok}" path:.yml NOT example',
                f'"{tok}" language:python',
                f'"{tok}" language:javascript',
                f'"{tok}" language:typescript',
            ]
    queries = list(dict.fromkeys(queries))[:max_queries]

    for q in queries:
        for page in (1, 2):
            data = _gh_get(f"https://api.github.com/search/code"
                           f"?q={requests.utils.quote(q)}&per_page=100&page={page}")
            items = (data or {}).get("items") or []
            if not items:
                break
            for item in items:
                full = item["repository"]["full_name"]
                owner, repo = full.split("/", 1)
                meta = _gh_get(f"https://api.github.com/repos/{owner}/{repo}")
                branch = (meta or {}).get("default_branch", "main")
                content = _fetch_raw(_raw_url(owner, repo, branch, item["path"]))
                if not content:
                    continue
                for key, prov in match_keys(content, providers):
                    found.setdefault(key, {
                        "key": key, "provider": prov, "source": full,
                        "repoUrl": item.get("html_url"), "filePath": item["path"],
                        "sourceType": "github",
                    })
            time.sleep(0.15)
    log(f"github: {len(found)} candidate keys")
    return found


def scan_gitlab(providers, max_queries, log):
    found = {}
    token = os.environ.get("GITLAB_TOKEN")
    if not token:
        log("gitlab: no GITLAB_TOKEN set — skipping")
        return found
    headers = {"PRIVATE-TOKEN": token}
    seen_tokens = []
    for p in providers:
        cfg = PROVIDERS.get(p)
        if cfg:
            seen_tokens += cfg["search_tokens"]
    for tok in list(dict.fromkeys(seen_tokens))[:max_queries]:
        try:
            r = requests.get("https://gitlab.com/api/v4/search",
                             headers=headers,
                             params={"scope": "blobs", "search": tok, "per_page": 50},
                             timeout=TIMEOUT)
            if not r.ok:
                continue
            for blob in r.json():
                text = blob.get("data") or ""
                proj = blob.get("project_id")
                for key, prov in match_keys(text, providers):
                    found.setdefault(key, {
                        "key": key, "provider": prov, "source": f"gitlab:project/{proj}",
                        "repoUrl": f"https://gitlab.com/api/v4/projects/{proj}",
                        "filePath": blob.get("path", ""), "sourceType": "gitlab",
                    })
        except Exception:
            pass
        time.sleep(0.2)
    log(f"gitlab: {len(found)} candidate keys")
    return found


def scan_pastebin(providers, log):
    found = {}
    if os.environ.get("PASTEBIN_API_SCRAPE") != "1":
        log("pastebin: PASTEBIN_API_SCRAPE!=1 — skipping (requires Pro account)")
        return found
    try:
        r = requests.get("https://scrape.pastebin.com/api_scraping.php?limit=100", timeout=8)
        if not r.ok:
            return found
        for paste in r.json():
            content = _fetch_raw(paste.get("scrape_url"))
            if not content:
                continue
            for key, prov in match_keys(content, providers):
                found.setdefault(key, {
                    "key": key, "provider": prov, "source": f"pastebin:{paste.get('key')}",
                    "repoUrl": paste.get("full_url") or f"https://pastebin.com/{paste.get('key')}",
                    "filePath": "", "sourceType": "pastebin",
                })
            time.sleep(0.05)
    except Exception:
        pass
    log(f"pastebin: {len(found)} candidate keys")
    return found


# ── Orchestration ──────────────────────────────────────────────────────────
def run_scan(providers, sources, max_queries, workers, log):
    all_keys = {}
    if "github" in sources:
        all_keys.update(scan_github(providers, max_queries, log))
    if "gitlab" in sources:
        all_keys.update(scan_gitlab(providers, max_queries, log))
    if "pastebin" in sources:
        all_keys.update(scan_pastebin(providers, log))

    log(f"validating {len(all_keys)} unique keys with {workers} workers...")

    def _process(meta):
        status = validate_key(meta["key"], meta["provider"])
        cfg = PROVIDERS.get(meta["provider"], {})
        balance = None
        if cfg.get("tier") == "paid" and status in ("valid", "rate_limited"):
            balance = check_balance(meta["key"], meta["provider"])
        meta["status"] = status
        meta["balance"] = balance
        meta["worthNotify"] = is_worth_notifying(meta["provider"], status, balance)
        return meta

    results = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_process, m) for m in all_keys.values()]
        for f in as_completed(futs):
            results.append(f.result())
    return results


def _fmt_balance(b):
    if not b:
        return ""
    if b.get("amountUsd") is not None:
        return f" | balance=${b['amountUsd']}"
    for k in ("tier", "accountType", "isFreeTier"):
        if k in b:
            return f" | {k}={b[k]}"
    if b.get("hasBalance") is True:
        return " | balance=yes(unbounded/unknown-amount)"
    if b.get("hasBalance") is False:
        return " | balance=none"
    return f" | balance=? ({b.get('source')})"


def write_result(results, out_path):
    worth = [r for r in results if r["worthNotify"]]
    paid_empty = [r for r in results
                  if PROVIDERS.get(r["provider"], {}).get("tier") == "paid"
                  and not r["worthNotify"]
                  and r["status"] in ("valid", "valid_no_balance", "rate_limited")]
    free_live = [r for r in results
                 if PROVIDERS.get(r["provider"], {}).get("tier") == "free"
                 and r["status"] in ("valid", "rate_limited")]

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    lines = []
    lines.append("=" * 78)
    lines.append("API KEY LEAK SCAN — RESULT")
    lines.append(f"Generated: {now}")
    lines.append(f"Total candidates: {len(results)}")
    lines.append(f"Worth notifying (paid + balance): {len(worth)}")
    lines.append(f"Paid but empty/no-balance: {len(paid_empty)}")
    lines.append(f"Free-tier live (reference only): {len(free_live)}")
    lines.append("=" * 78)

    def block(title, rows, show_balance=True):
        lines.append("")
        lines.append(f"### {title} ({len(rows)})")
        lines.append("-" * 78)
        if not rows:
            lines.append("(none)")
            return
        for r in sorted(rows, key=lambda x: (x["provider"], x["source"])):
            bal = _fmt_balance(r["balance"]) if show_balance else ""
            lines.append(f"[{r['provider']}] {r['status']}{bal}")
            lines.append(f"    key:  {r['key'][:28]}...")
            lines.append(f"    src:  {r['source']}")
            lines.append(f"    url:  {r.get('repoUrl') or ''}")
            if r.get("filePath"):
                lines.append(f"    file: {r['filePath']}")

    block("WORTH NOTIFYING — PAID KEYS WITH REAL BALANCE", worth)
    block("PAID KEYS BUT EMPTY / $0 (no financial risk — do NOT notify)", paid_empty)
    block("FREE-TIER LIVE KEYS (reference only — no cost to owner)", free_live)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser(description="Defensive API-key leak scanner")
    ap.add_argument("--providers", nargs="*", default=list(PROVIDERS.keys()),
                    help="providers to scan (default: all)")
    ap.add_argument("--sources", nargs="*", default=["github", "gitlab", "pastebin"],
                    choices=["github", "gitlab", "pastebin"])
    ap.add_argument("--out", default="result.txt")
    ap.add_argument("--max-queries", type=int, default=40)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    bad = [p for p in args.providers if p not in PROVIDERS]
    if bad:
        sys.exit(f"Unknown providers: {bad}. Available: {list(PROVIDERS)}")

    def log(msg):
        print(f"[scanner] {msg}", file=sys.stderr, flush=True)

    log(f"providers={args.providers} sources={args.sources}")
    start_time = time.time()
    results = run_scan(args.providers, args.sources, args.max_queries, args.workers, log)
    elapsed_time = time.time() - start_time
    log(f"Scan completed in {elapsed_time:.2f} seconds.")
    write_result(results, args.out)
    worth = sum(1 for r in results if r["worthNotify"])
    log(f"done. {len(results)} candidates, {worth} worth notifying. → {args.out}")


if __name__ == "__main__":
    main()
