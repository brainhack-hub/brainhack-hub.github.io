#!/usr/bin/env python3
"""brain-hack: validate a day file, (re)compute scores/ranks, rebuild data/index.json.

Usage:
  python3 scripts/add_day.py data/2026-10-26.json            # validate only (exit 1 on errors)
  python3 scripts/add_day.py data/2026-10-26.json --fix      # recompute total_score + rank, rewrite file, rebuild index
  python3 scripts/add_day.py --rebuild-index                 # only rebuild data/index.json
  python3 scripts/add_day.py data/2026-10-26.json --check-links   # also HTTP-check every source URL
  python3 scripts/add_day.py --all                           # validate every day file in data/

Standard library only (Python 3.8+).
"""
import argparse, glob, json, os, re, sys, urllib.request, urllib.error
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VERIFICATION = {"2+ nguồn độc lập", "1 nguồn gốc", "chưa xác minh"}
CONFIDENCE = {"cao", "trung bình", "thấp–trung bình", "thấp"}
HOW_READ_OPEN = "mở trang"

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

def weights(cfg):
    w = {c["key"]: c["weight"] for c in cfg["criteria"]}
    return w

def total(scores, w):
    return round(sum(scores[k] * w[k] for k in w), 2)

def rank_ideas(ideas, w):
    for i in ideas:
        i["total_score"] = total(i["scores"], w)
    order = sorted(ideas, key=lambda i: (-i["total_score"], -i["scores"]["china"], -i["scores"]["demand"], i["id"]))
    for n, i in enumerate(order, 1):
        i["rank"] = n
    ideas.sort(key=lambda i: i["rank"])

def is_url(u):
    return isinstance(u, str) and re.match(r"^https?://[^\s]+$", u) is not None

def check_sources(label, sources, facts, errors, warns):
    ids = set()
    for s in sources:
        for k in ("id", "name", "title", "url", "accessed", "how_read"):
            if not s.get(k):
                errors.append(f"{label}: nguồn thiếu '{k}': {s}")
        if s.get("id") in ids:
            errors.append(f"{label}: trùng id nguồn {s.get('id')}")
        ids.add(s.get("id"))
        if s.get("url") and not is_url(s["url"]):
            errors.append(f"{label}: URL không hợp lệ: {s.get('url')}")
        for dk in ("published", "accessed"):
            v = s.get(dk)
            if v and not (DATE_RE.match(v) or re.match(r"^\d{4}-\d{2}$", v)):
                errors.append(f"{label}: ngày '{dk}' sai định dạng: {v}")
        if s.get("published") is None and not s.get("note"):
            warns.append(f"{label}: nguồn {s.get('id')} không có ngày đăng và không có ghi chú giải thích")
        if s.get("how_read") and s["how_read"] != HOW_READ_OPEN and not s.get("note"):
            warns.append(f"{label}: nguồn {s.get('id')} đọc gián tiếp nhưng thiếu ghi chú")
    if not facts:
        errors.append(f"{label}: thiếu key_facts")
    for f in facts:
        if f.get("verification") not in VERIFICATION:
            errors.append(f"{label}: verification không hợp lệ: {f.get('verification')}")
        sids = f.get("source_ids") or []
        if not f.get("text"):
            errors.append(f"{label}: fact thiếu text")
        for sid in sids:
            if sid not in ids:
                errors.append(f"{label}: fact tham chiếu nguồn không tồn tại: {sid}")
        if f.get("verification") == "2+ nguồn độc lập" and len(set(sids)) < 2:
            errors.append(f"{label}: fact ghi '2+ nguồn' nhưng chỉ có {len(set(sids))} nguồn: {f.get('text')[:60]}")
        if f.get("verification") == "1 nguồn gốc" and len(sids) < 1:
            errors.append(f"{label}: fact '1 nguồn gốc' không có nguồn: {f.get('text')[:60]}")
        if f.get("verification") == "chưa xác minh" and not f.get("note"):
            warns.append(f"{label}: fact 'chưa xác minh' nên có note")

def validate(day, cfg, path, fix=False):
    errors, warns = [], []
    w = weights(cfg)
    if abs(sum(w.values()) - 1.0) > 1e-9:
        errors.append(f"config: tổng trọng số = {sum(w.values())} (phải = 1)")
    fname_date = os.path.basename(path).replace(".json", "")
    if day.get("date") != fname_date:
        errors.append(f"date trong file ({day.get('date')}) ≠ tên file ({fname_date})")
    if not DATE_RE.match(str(day.get("date"))):
        errors.append("date sai định dạng YYYY-MM-DD")
    for k in ("headline", "summary", "generated_at"):
        if not day.get(k):
            errors.append(f"thiếu trường '{k}'")
    trends = day.get("trends", [])
    ideas = day.get("ideas", [])
    if not (4 <= len(trends) <= 6):
        errors.append(f"cần 4–6 trend signals, đang có {len(trends)}")
    if len(ideas) < 1:
        errors.append("không có ý tưởng")
    elif len(ideas) != 8:
        warns.append(f"chuẩn là 8 ý tưởng/ngày, đang có {len(ideas)}")
    cats = {c["id"] for c in cfg["categories"]}
    types = {t["id"] for t in cfg["types"]}
    ids = set()
    for t in trends:
        lab = f"trend {t.get('id')}"
        for k in ("id", "title", "summary", "why_it_matters", "key_facts", "sources"):
            if not t.get(k):
                errors.append(f"{lab}: thiếu '{k}'")
        check_sources(lab, t.get("sources", []), t.get("key_facts", []), errors, warns)
        if len(t.get("sources", [])) < 1:
            errors.append(f"{lab}: cần ít nhất 1 nguồn")
    for i in ideas:
        lab = f"idea {i.get('id')}"
        if i.get("id") in ids:
            errors.append(f"{lab}: trùng id")
        ids.add(i.get("id"))
        if not str(i.get("id", "")).startswith(day.get("date", "").replace("-", "")):
            errors.append(f"{lab}: id phải bắt đầu bằng YYYYMMDD của ngày")
        if i.get("date") != day.get("date"):
            errors.append(f"{lab}: date ≠ ngày của file")
        for k in ("title", "pitch", "china_signal", "localize_vn", "first_steps", "risks", "category", "type",
                  "capital", "scores", "key_facts", "sources", "confidence", "hypothesis"):
            if i.get(k) in (None, "", []):
                errors.append(f"{lab}: thiếu '{k}'")
        if i.get("type") not in types:
            errors.append(f"{lab}: type không hợp lệ: {i.get('type')}")
        for c in i.get("category", []):
            if c not in cats:
                errors.append(f"{lab}: category không hợp lệ: {c}")
        if i.get("confidence") not in CONFIDENCE:
            errors.append(f"{lab}: confidence không hợp lệ: {i.get('confidence')}")
        if i.get("hypothesis") and not i.get("hypothesis_note"):
            errors.append(f"{lab}: hypothesis=true nhưng thiếu hypothesis_note")
        sc = i.get("scores", {})
        for k in w:
            v = sc.get(k)
            if not isinstance(v, int) or not (1 <= v <= 10):
                errors.append(f"{lab}: điểm '{k}' phải là số nguyên 1–10, đang là {v}")
        cap = i.get("capital", {})
        for k in ("vnd_min_m", "vnd_max_m", "usd_min", "usd_max", "note"):
            if cap.get(k) is None:
                errors.append(f"{lab}: capital thiếu '{k}'")
        if cap.get("vnd_min_m") is not None and cap.get("vnd_max_m") is not None:
            if cap["vnd_min_m"] > cap["vnd_max_m"]:
                errors.append(f"{lab}: capital min > max")
            rate = cfg["usd_vnd_rate"]
            for a, b in (("vnd_min_m", "usd_min"), ("vnd_max_m", "usd_max")):
                exp = cap[a] * 1e6 / rate
                if abs(cap[b] - exp) > max(30, 0.15 * exp):
                    warns.append(f"{lab}: {b}={cap[b]} lệch so với quy đổi {exp:.0f} (tỷ giá {rate})")
        check_sources(lab, i.get("sources", []), i.get("key_facts", []), errors, warns)
        # an idea must have at least one fact backing the China signal
        if not any(f.get("source_ids") for f in i.get("key_facts", [])):
            errors.append(f"{lab}: không có fact nào gắn nguồn")
        if len(i.get("first_steps", [])) < 3:
            warns.append(f"{lab}: nên có ≥ 3 bước thử trong 1 tuần")
        if not any("%" in (f.get("text") or "") or any(ch.isdigit() for ch in (f.get("text") or "")) for f in i.get("key_facts", [])):
            warns.append(f"{lab}: key_facts không có con số nào (kiểm tra có đủ dữ kiện cụ thể?)")
    # ranking
    if ideas:
        import copy
        probe = copy.deepcopy(ideas)
        rank_ideas(probe, w)
        by_id = {p["id"]: p for p in probe}
        for i in ideas:
            p = by_id[i["id"]]
            if i.get("total_score") != p["total_score"]:
                (warns if fix else errors).append(f"idea {i['id']}: total_score={i.get('total_score')} ≠ tính lại {p['total_score']}")
            if i.get("rank") != p["rank"]:
                (warns if fix else errors).append(f"idea {i['id']}: rank={i.get('rank')} ≠ tính lại {p['rank']}")
    return errors, warns

def check_links(day):
    bad = 0
    urls = {}
    for blk in day.get("trends", []) + day.get("ideas", []):
        for s in blk.get("sources", []):
            urls[s["url"]] = s["id"]
    for u in urls:
        ok, code = False, None
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(u, method=method, headers={"User-Agent": "Mozilla/5.0 brain-hack-linkcheck"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    code = r.status; ok = code < 400; break
            except urllib.error.HTTPError as e:
                code = e.code
                if method == "GET": break
            except Exception as e:
                code = type(e).__name__
                if method == "GET": break
        print(("  OK  " if ok else " WARN ") + f"[{code}] {u}")
        if not ok: bad += 1
    print(f"link check: {len(urls) - bad}/{len(urls)} OK (WARN thường do trang chặn bot; kiểm tra tay nếu cần)")
    return bad

def rebuild_index(cfg):
    days = []
    for p in sorted(glob.glob(os.path.join(DATA, "????-??-??.json")), reverse=True):
        d = load(p)
        top = sorted(d.get("ideas", []), key=lambda i: i.get("rank", 99))[:1]
        days.append({
            "date": d["date"], "file": os.path.basename(p),
            "headline": d.get("headline", ""),
            "idea_count": len(d.get("ideas", [])), "trend_count": len(d.get("trends", [])),
            "top": ({"title": top[0]["title"], "total_score": top[0].get("total_score")} if top else None),
        })
    idx = {"updated": date.today().isoformat(), "latest": days[0]["date"] if days else None, "days": days}
    save(os.path.join(DATA, "index.json"), idx)
    print(f"index.json: {len(days)} ngày, mới nhất {idx['latest']}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?")
    ap.add_argument("--fix", action="store_true", help="tính lại total_score + rank, ghi lại file, dựng lại index")
    ap.add_argument("--rebuild-index", action="store_true")
    ap.add_argument("--check-links", action="store_true")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    cfg = load(os.path.join(DATA, "config.json"))
    w = weights(cfg)
    if a.rebuild_index and not a.file:
        rebuild_index(cfg); return 0
    files = sorted(glob.glob(os.path.join(DATA, "????-??-??.json"))) if a.all else ([a.file] if a.file else [])
    if not files:
        ap.print_help(); return 2
    rc = 0
    for f in files:
        day = load(f)
        if a.fix:
            rank_ideas(day.get("ideas", []), w)
            save(f, day)
        errs, warns = validate(day, cfg, f, fix=a.fix)
        print(f"== {os.path.relpath(f, ROOT)}: {len(errs)} lỗi, {len(warns)} cảnh báo")
        for e in errs: print("  ERROR:", e)
        for x in warns: print("  warn :", x)
        if errs: rc = 1
        if a.check_links: check_links(day)
    if rc == 0 and (a.fix or a.all):
        rebuild_index(cfg)
    return rc

if __name__ == "__main__":
    sys.exit(main())
