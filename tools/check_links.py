#!/usr/bin/env python3
"""Check every link a page depends on: external pages must answer, local files (logos, images, scripts) must exist,
and in-page anchors must point at an element that is there. Exits 1 if anything is broken.

usage: python3 tools/check_links.py [page.html ...]   (default: index.html)
"""
import concurrent.futures as cf
import html.parser
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
# sites that refuse automated requests even though the page is fine for people: a refusal is not a broken link
BOT_WALLED = ("linkedin.com", "instagram.com", "x.com", "twitter.com", "facebook.com")
SKIP_SCHEMES = ("mailto:", "tel:", "javascript:", "data:")


class Collector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "link" and (a.get("rel") or "").lower() in ("preconnect", "dns-prefetch"):
            return                                          # connection hints, not pages
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append((tag, key, a[key].strip()))
        if tag == "img" and a.get("srcset"):
            for part in a["srcset"].split(","):
                self.refs.append((tag, "srcset", part.strip().split(" ")[0]))


def refs_in_scripts(text):
    """Logos and links that only appear inside script data (e.g. logo: "logos/x.svg", url: "https://...")."""
    found = re.findall(r'(?:logo|url|href|src)\s*:\s*"([^"]+)"', text)
    return [("script", "data", f) for f in found]


def check_url(url):
    host = urllib.parse.urlparse(url).hostname or ""
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.status, None
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 400, 404, 429, 501):
                continue                                   # some servers only answer GET
            if any(host.endswith(d) for d in BOT_WALLED) and e.code in (403, 429, 999):
                return e.code, "bot-walled (fine for people)"
            return e.code, f"HTTP {e.code}"
        except Exception as e:  # DNS failure, timeout, TLS error
            if method == "HEAD":
                continue
            return 0, f"{type(e).__name__}: {str(e)[:80]}"
    return 0, "no answer"


def main(pages):
    broken, checked = [], 0
    for page in pages:
        page = Path(page)
        text = page.read_text(encoding="utf-8")
        col = Collector()
        col.feed(text)
        refs = col.refs + refs_in_scripts(text)
        external, local = set(), set()
        for tag, key, ref in refs:
            if not ref or ref.startswith(SKIP_SCHEMES) or "${" in ref:
                continue
            if ref.startswith("#"):
                if ref != "#" and ref[1:] not in col.ids:
                    broken.append(f"{page}: in-page link {ref} has no element with that id")
                continue
            if ref.startswith("//"):
                ref = "https:" + ref
            if ref.startswith(("http://", "https://")):
                external.add(ref)
            else:
                local.add(urllib.parse.unquote(ref.split("#")[0].split("?")[0]))
        for ref in sorted(local):
            checked += 1
            target = (page.parent / ref.lstrip("/")).resolve()  # "/x" means the site root, which is the page's folder here
            if ref.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                broken.append(f"{page}: missing local file {ref}")
        with cf.ThreadPoolExecutor(max_workers=12) as pool:
            for url, (code, problem) in zip(sorted(external), pool.map(check_url, sorted(external))):
                checked += 1
                if problem and not problem.startswith("bot-walled"):
                    broken.append(f"{page}: {url} -> {problem}")
                elif problem:
                    print(f"  note: {url} {problem}")
    print(f"checked {checked} links across {len(pages)} page(s)")
    if broken:
        print("BROKEN:")
        for b in broken:
            print("  " + b)
        return 1
    print("all links work")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["index.html"]))
