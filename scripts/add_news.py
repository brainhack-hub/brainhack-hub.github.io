#!/usr/bin/env python3
"""brain-hack · Đọc báo: kiểm tra data/news/YYYY-MM-DD.json, khử trùng URL giữa các ngày, dựng data/news/index.json.

Usage:
  python3 scripts/add_news.py data/news/2026-10-26.json            # kiểm tra 1 ngày (exit 1 nếu có lỗi)
  python3 scripts/add_news.py data/news/2026-10-26.json --check-links   # + kiểm tra HTTP từng url
  python3 scripts/add_news.py --all                                # kiểm tra mọi ngày + dựng lại index
  python3 scripts/add_news.py --rebuild-index                      # chỉ dựng lại data/news/index.json

Chỉ dùng thư viện chuẩn (Python 3.8+). Quy tắc nghiêm ngặt nằm trong DAILY_UPDATE.md (mục "Đọc báo").
"""
import argparse, glob, json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, date, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
NEWS = os.path.join(DATA, "news")
VN = timezone(timedelta(hours=7))
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOPICS = [("ai_xd", "AI trong xây dựng"), ("chuoi_cung_ung", "Chuỗi cung ứng"), ("cong_nghe", "Công nghệ"), ("vn", "VN – thị trường")]
REGIONS = [("VN", "Việt Nam"), ("US", "Mỹ"), ("EU", "Châu Âu"), ("AU", "Úc"), ("CN", "Trung Quốc"), ("KR", "Hàn Quốc"), ("JP", "Nhật Bản"), ("SEA", "Đông Nam Á"), ("Global", "Toàn cầu")]
VERIFICATION = ["đọc đầy đủ", "đọc một phần", "chỉ đọc đoạn trích", "chỉ đọc tiêu đề"]
SOURCE_TYPES = ["tin độc lập", "thông cáo/blog nhà cung cấp", "ý kiến", "khảo sát/báo cáo", "bảng giá tổng hợp", "văn bản/sự kiện cơ quan nhà nước"]
REQ = ["id", "title", "title_vi", "source", "url", "published", "time_known", "date_basis", "topic", "region", "summary_vi",
       "why_it_matters", "tags", "verification", "source_type", "how_read", "accessed"]
TOPIC_IDS = {t for t, _ in TOPICS}
REGION_IDS = {r for r, _ in REGIONS}

def load(p):
    with open(p, encoding="utf-8") as f: return json.load(f)
def save(p, o):
    with open(p, "w", encoding="utf-8") as f: json.dump(o, f, ensure_ascii=False, indent=2)
def is_url(u): return isinstance(u, str) and re.match(r"^https://[^\s/]+\.[^\s]+$", u) is not None

def norm_url(u):
    u = re.sub(r"#.*$", "", u.strip())
    u = re.sub(r"([?&])(utm_[a-z]+|fbclid|gclid)=[^&]*", r"\1", u).rstrip("?&")
    return u.rstrip("/").lower().replace("://www.", "://")

def parse_pub(p):
    """Trả về (datetime theo UTC+7 hoặc None, chỉ-ngày:bool). Ném ValueError nếu sai định dạng."""
    if DATE_RE.match(p):
        d = date.fromisoformat(p); return datetime(d.year, d.month, d.day, tzinfo=VN), True
    dt = datetime.fromisoformat(p.replace("Z", "+00:00"))
    if dt.tzinfo is None: raise ValueError("thiếu múi giờ (dùng +07:00, Z hoặc ±hh:mm)")
    return dt.astimezone(VN), False

def sentences(t):
    return [s for s in re.split(r"(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ0-9“\"'(])", t.strip()) if s]

def known_idea_ids():
    ids = set()
    for f in glob.glob(os.path.join(DATA, "????-??-??.json")):
        try:
            for i in load(f).get("ideas", []): ids.add(i["id"])
        except Exception: pass
    return ids

def validate(day, path, other_urls):
    errs, warns = [], []
    E, W = errs.append, warns.append
    name = os.path.basename(path)
    d = day.get("date")
    if not (isinstance(d, str) and DATE_RE.match(d)): E("date thiếu/sai định dạng YYYY-MM-DD"); return errs, warns
    if name != f"{d}.json": E(f"tên file {name} không khớp date {d}")
    day_end = datetime.fromisoformat(d + "T23:59:59+07:00")
    for k in ("headline", "generated_at"):
        if not day.get(k): E(f"thiếu {k}")
    items = day.get("items") or []
    if not items: E("không có items"); return errs, warns
    ids, urls, ideas = set(), {}, known_idea_ids()
    cnt = {t: 0 for t in TOPIC_IDS}
    for n, it in enumerate(items, 1):
        pre = f"item#{n} ({it.get('id', '?')})"
        for k in REQ:
            if it.get(k) in (None, "", []): E(f"{pre}: thiếu {k}")
        if not re.match(r"^n-" + d.replace("-", "") + r"-\d{2}-[a-z0-9-]+$", str(it.get("id", ""))): E(f"{pre}: id phải dạng n-{d.replace('-', '')}-NN-slug")
        if it.get("id") in ids: E(f"{pre}: id trùng")
        ids.add(it.get("id"))
        if it.get("topic") not in TOPIC_IDS: E(f"{pre}: topic phải thuộc {sorted(TOPIC_IDS)}")
        else: cnt[it["topic"]] += 1
        if it.get("region") not in REGION_IDS: E(f"{pre}: region phải thuộc {sorted(REGION_IDS)}")
        if it.get("verification") not in VERIFICATION: E(f"{pre}: verification phải thuộc {VERIFICATION}")
        if it.get("source_type") not in SOURCE_TYPES: E(f"{pre}: source_type phải thuộc {SOURCE_TYPES}")
        s = it.get("source") or {}
        if not (isinstance(s, dict) and s.get("name") and s.get("kind")): E(f"{pre}: source cần name + kind")
        u = it.get("url", "")
        if not is_url(u): E(f"{pre}: url phải là https hợp lệ")
        else:
            nu = norm_url(u)
            if nu in urls: E(f"{pre}: url trùng trong ngày với {urls[nu]}")
            urls[nu] = it.get("id")
            if nu in other_urls: E(f"{pre}: url đã xuất hiện ở ngày {other_urls[nu]} (khử trùng)")
        # ngày đăng
        try:
            pub, only_date = parse_pub(it.get("published", ""))
            if only_date and it.get("time_known"): E(f"{pre}: published chỉ có ngày nhưng time_known=true")
            if not only_date and "T" in it["published"] and it.get("time_known") is not True and not it.get("older_than_7d") and not str(it["published"]).endswith("T00:00:00Z"):
                W(f"{pre}: có giờ trong published nhưng time_known=false — kiểm tra lại")
            if pub > day_end: E(f"{pre}: published ({pub.isoformat()}) nằm sau ngày {d}")
            age = (datetime.fromisoformat(d + "T00:00:00+07:00") - pub).days
            if age > 7 and not it.get("older_than_7d"): E(f"{pre}: cũ {age} ngày (>7) nhưng chưa gắn older_than_7d + older_note")
            if it.get("older_than_7d"):
                if not it.get("older_note"): E(f"{pre}: older_than_7d cần older_note")
                if age <= 7: W(f"{pre}: gắn older_than_7d nhưng chỉ cũ {age} ngày")
        except (ValueError, TypeError) as e:
            E(f"{pre}: published sai ({e})")
        if it.get("accessed") and (not DATE_RE.match(str(it["accessed"])) or it["accessed"] > d): E(f"{pre}: accessed phải là ngày ≤ {d}")
        sm = it.get("summary_vi", "")
        ns = len(sentences(sm))
        if not 2 <= ns <= 4: E(f"{pre}: summary_vi phải 2–4 câu (đang {ns})")
        if len(sm) > 1100: W(f"{pre}: summary_vi dài {len(sm)} ký tự — rút gọn")
        for q in re.findall(r"[“\"]([^”\"]{20,})[”\"]", sm):
            if len(q.split()) > 25: E(f"{pre}: trích dẫn nguyên văn quá dài ({len(q.split())} từ)")
        wm = it.get("why_it_matters", "")
        if wm and not 20 <= len(wm) <= 450: W(f"{pre}: why_it_matters nên 20–450 ký tự (đang {len(wm)})")
        if not (isinstance(it.get("tags"), list) and 1 <= len(it["tags"]) <= 8): E(f"{pre}: tags 1–8 mục")
        if it.get("verification") == "chỉ đọc tiêu đề" and ns > 2: W(f"{pre}: chỉ đọc tiêu đề mà tóm tắt dài — dễ suy diễn")
        if it.get("verification") in ("đọc một phần", "chỉ đọc đoạn trích") and not re.search(r"(một phần|đoạn|phần đầu|không đọc|chưa đọc|%)", it.get("how_read", "")):
            W(f"{pre}: verification không đầy đủ — how_read nên nói rõ đã đọc phần nào")
        for iid in it.get("idea_ids", []) or []:
            if iid not in ideas: E(f"{pre}: idea_ids '{iid}' không tồn tại trong data/*.json")
    if len(items) < 15: W(f"chỉ {len(items)} tin (mục tiêu 15–25)")
    if len(items) > 30: W(f"{len(items)} tin — nhiều hơn 30, cân nhắc cắt bớt")
    if cnt["ai_xd"] < 8: W(f"chỉ {cnt['ai_xd']} tin AI trong xây dựng (mục tiêu ≥ 8)")
    dg = day.get("digest") or []
    if len(dg) != 5: E(f"digest phải đúng 5 điểm (đang {len(dg)})")
    for i, p in enumerate(dg, 1):
        for k in ("title", "text"):
            if not p.get(k): E(f"digest#{i}: thiếu {k}")
        if not p.get("item_ids"): E(f"digest#{i}: cần item_ids")
        for x in p.get("item_ids", []):
            if x not in ids: E(f"digest#{i}: item_id '{x}' không có trong items")
    ur = day.get("unreachable")
    if ur is None: E("thiếu unreachable (danh sách nguồn không mở được/paywall; có thể là [])")
    else:
        for i, x in enumerate(ur, 1):
            if not (x.get("source") and x.get("status")): E(f"unreachable#{i}: cần source + status")
    return errs, warns

def collect_other_urls(skip_path):
    seen = {}
    for f in sorted(glob.glob(os.path.join(NEWS, "????-??-??.json"))):
        if os.path.abspath(f) == os.path.abspath(skip_path): continue
        try: d = load(f)
        except Exception: continue
        for it in d.get("items", []):
            if it.get("url"): seen.setdefault(norm_url(it["url"]), d.get("date"))
    return seen

def rebuild_index():
    days = []
    for f in sorted(glob.glob(os.path.join(NEWS, "????-??-??.json")), reverse=True):
        d = load(f)
        its = d.get("items", [])
        days.append({"date": d["date"], "file": os.path.basename(f), "headline": d.get("headline", ""), "item_count": len(its),
                     "topics": {t: sum(1 for i in its if i.get("topic") == t) for t, _ in TOPICS}})
    idx = {"updated": days[0]["date"] if days else None, "latest": days[0]["date"] if days else None,
           "topics": [{"id": t, "label": l} for t, l in TOPICS], "regions": [{"id": r, "label": l} for r, l in REGIONS],
           "verification": VERIFICATION, "days": days}
    save(os.path.join(NEWS, "index.json"), idx)
    print(f"đã dựng data/news/index.json ({len(days)} ngày)")

def check_links(day):
    bad = 0
    its = day.get("items", [])
    for it in its:
        u, ok, code = it["url"], False, None
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(u, method=method, headers={"User-Agent": "Mozilla/5.0 brain-hack-linkcheck"})
                with urllib.request.urlopen(req, timeout=25) as r: code = r.status; ok = code < 400; break
            except urllib.error.HTTPError as e:
                code = e.code
                if method == "GET": break
            except Exception as e:
                code = type(e).__name__
                if method == "GET": break
        print(("  OK  " if ok else " WARN ") + f"[{code}] {u}")
        if not ok: bad += 1
    print(f"link check: {len(its) - bad}/{len(its)} OK (WARN 403 thường do trang chặn bot; mở tay bằng trình duyệt để xác nhận)")

def run_all(links=False):
    """Dùng chung cho add_day.py --all. Trả về 0 nếu mọi ngày hợp lệ."""
    rc = 0
    files = sorted(glob.glob(os.path.join(NEWS, "????-??-??.json")))
    for f in files:
        day = load(f)
        errs, warns = validate(day, f, collect_other_urls(f))
        print(f"== {os.path.relpath(f, ROOT)}: {len(day.get('items', []))} tin, {len(errs)} lỗi, {len(warns)} cảnh báo")
        for e in errs: print("  ERROR:", e)
        for x in warns: print("  warn :", x)
        if errs: rc = 1
        if links: check_links(day)
    if rc == 0 and files: rebuild_index()
    return rc

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--rebuild-index", action="store_true")
    ap.add_argument("--check-links", action="store_true")
    a = ap.parse_args()
    if a.rebuild_index and not a.file and not a.all: rebuild_index(); return 0
    if a.all: return run_all(a.check_links)
    if not a.file: ap.print_help(); return 2
    day = load(a.file)
    errs, warns = validate(day, a.file, collect_other_urls(a.file))
    print(f"== {os.path.relpath(os.path.abspath(a.file), ROOT)}: {len(day.get('items', []))} tin, {len(errs)} lỗi, {len(warns)} cảnh báo")
    for e in errs: print("  ERROR:", e)
    for x in warns: print("  warn :", x)
    if a.check_links: check_links(day)
    if not errs: rebuild_index()
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main())
