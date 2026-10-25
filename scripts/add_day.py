#!/usr/bin/env python3
"""brain-hack: validate a day file, (re)compute scores/ranks, rebuild data/index.json.

Usage:
  python3 scripts/add_day.py data/2026-10-26.json            # validate only (exit 1 on errors)
  python3 scripts/add_day.py data/2026-10-26.json --fix      # recompute total_score + rank, rewrite file, rebuild index
  python3 scripts/add_day.py --rebuild-index                 # only rebuild data/index.json
  python3 scripts/add_day.py data/2026-10-26.json --check-links   # also HTTP-check every source URL
  python3 scripts/add_day.py --all                           # validate every day file in data/ + data/vn-youth.json
  python3 scripts/add_day.py --youth [--check-links]         # validate only the VN youth profile (data/vn-youth.json)
  python3 scripts/add_day.py --tools [--check-links]         # validate only the tool registry (data/tools.json)

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
VN_AVAIL = {"đã xác minh", "có hạn chế", "chưa xác minh"}
PRICE_RE = re.compile(r"[$€£]\s?\d|\d\s?(?:USD|EUR|đ\b|VND|NDT|¥)|\d\s?/\s?(?:tháng|giây|ảnh|mo\b|month)", re.I)
_TOOLS_CACHE = {}
def tool_ids():
    if "ids" not in _TOOLS_CACHE:
        pth = os.path.join(DATA, "tools.json")
        _TOOLS_CACHE["ids"] = {t["id"]: t for t in load(pth).get("tools", [])} if os.path.exists(pth) else {}
    return _TOOLS_CACHE["ids"]


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
    order = sorted(ideas, key=lambda i: (-i["total_score"], -i["scores"]["signal"], -i["scores"]["demand"], i["id"]))
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
    if len(trends) < 4:
        errors.append(f"cần ≥ 4 trend signals (đa vùng), đang có {len(trends)}")
    elif len(trends) > 16:
        warns.append(f"{len(trends)} trend signals — nhiều bất thường (chuẩn 6–12/ngày)")
    if not any("CN" in (t.get("regions") or []) for t in trends):
        warns.append("không có trend nào gắn vùng CN (Trung Quốc là trọng tâm chính)")
    if len({r for t in trends for r in (t.get("regions") or [])}) < 3:
        warns.append("trend signals nên phủ ≥ 3 vùng (CN + KR/US/JP/…)")
    if len(ideas) < 1:
        errors.append("không có ý tưởng")
    elif len(ideas) < 8:
        warns.append(f"chuẩn là ≥ 8 ý tưởng/ngày, đang có {len(ideas)}")
    regions = {r["id"] for r in cfg["regions"]}
    try:
        yfacts = {f["id"] for sec in load(os.path.join(DATA, "vn-youth.json"))["sections"] for f in sec["facts"]}
    except Exception as e:
        yfacts = set(); errors.append(f"không đọc được data/vn-youth.json: {e}")
    cats = {c["id"] for c in cfg["categories"]}
    types = {t["id"] for t in cfg["types"]}
    ids = set()
    for t in trends:
        lab = f"trend {t.get('id')}"
        for k in ("id", "title", "summary", "why_it_matters", "key_facts", "sources", "regions"):
            if not t.get(k):
                errors.append(f"{lab}: thiếu '{k}'")
        for r in t.get("regions") or []:
            if r not in regions:
                errors.append(f"{lab}: region không hợp lệ: {r}")
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
        for k in ("title", "pitch", "signal_text", "localize_vn", "first_steps", "risks", "category", "type",
                  "capital", "scores", "key_facts", "sources", "confidence", "hypothesis", "regions",
                  "vn_youth_fit", "vn_fit_refs", "image", "image_alt", "claude_prompt"):
            if i.get(k) in (None, "", []):
                errors.append(f"{lab}: thiếu '{k}'")
        # ảnh minh hoạ: file có thật, ≤150KB, webp/png/jpg/svg trong assets/ideas/
        img = i.get("image")
        if img:
            ip = os.path.join(ROOT, img)
            if not img.startswith("assets/ideas/") or not img.lower().endswith((".webp", ".png", ".jpg", ".jpeg", ".svg")):
                errors.append(f"{lab}: image phải nằm trong assets/ideas/ và là webp/png/jpg/svg")
            elif not os.path.isfile(ip):
                errors.append(f"{lab}: không thấy file ảnh {img}")
            elif os.path.getsize(ip) > 150 * 1024:
                errors.append(f"{lab}: ảnh {img} > 150KB ({os.path.getsize(ip)//1024}KB)")
        if i.get("image_alt") and len(i["image_alt"]) < 15:
            warns.append(f"{lab}: image_alt quá ngắn")
        cp = i.get("claude_prompt") or ""
        if cp:
            if not (1500 <= len(cp) <= 12000):
                errors.append(f"{lab}: claude_prompt dài {len(cp)} ký tự (cần 1.500–12.000)")
            for h in ("## 1.", "## 2.", "## 3.", "## 4.", "## 5.", "## 6.", "## 7.", "## 8."):
                if h not in cp:
                    errors.append(f"{lab}: claude_prompt thiếu mục '{h}'")
            if i.get("title") and i["title"] not in cp:
                errors.append(f"{lab}: claude_prompt phải chứa nguyên tên ý tưởng")
            # chống bịa số liệu: số ≥ 21 trong prompt phải xuất hiện trong dữ liệu có nguồn của ý tưởng
            import re as _re
            src_txt = json.dumps({k: i.get(k) for k in ("title", "pitch", "signal_text", "key_facts", "vn_youth_fit",
                                  "localize_vn", "first_steps", "capital", "risks", "hypothesis_note")}, ensure_ascii=False)
            src_nums = set(_re.findall(r"\d[\d.,]*", src_txt))
            extra = sorted({n for n in _re.findall(r"\d[\d.,]*", cp) if n.rstrip(".,") not in {x.rstrip(".,") for x in src_nums}
                            and n.rstrip(".,").replace(".", "").replace(",", "").isdigit() and int(n.rstrip(".,").replace(".", "").replace(",", "")) > 20})
            if extra:
                warns.append(f"{lab}: claude_prompt có số không có trong dữ liệu nguồn của ý tưởng: {', '.join(extra[:8])} — kiểm tra không bịa")
        errors.extend(validate_toolstack(lab, i))
        for r in i.get("regions") or []:
            if r not in regions:
                errors.append(f"{lab}: region không hợp lệ: {r}")
        for r in i.get("vn_fit_refs") or []:
            if r not in yfacts:
                errors.append(f"{lab}: vn_fit_refs tham chiếu fact không tồn tại trong vn-youth.json: {r}")
        if i.get("scores", {}).get("vnfit", 0) >= 8 and len(i.get("vn_fit_refs") or []) < 2:
            warns.append(f"{lab}: vnfit ≥ 8 nên dẫn ≥ 2 dữ kiện giới trẻ (vn_fit_refs)")
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
    # trending keywords
    kws = day.get("keywords", [])
    if not kws:
        warns.append("không có 'keywords' (từ khóa & chủ đề hot theo vùng) — daily run phải làm mới mục này")
    ksrc = {x.get("id"): x for x in day.get("keyword_sources", [])}
    for sid, x in ksrc.items():
        for k in ("name", "title", "url", "accessed", "captured_at", "how_read"):
            if not x.get(k):
                errors.append(f"keyword_source {sid}: thiếu '{k}'")
        if x.get("url") and not is_url(x["url"]):
            errors.append(f"keyword_source {sid}: URL không hợp lệ")
    themes = {t["id"] for t in cfg.get("keyword_themes", [])}
    kconf = set(cfg.get("keyword_confidence", []))
    kids = set(); idea_ids = {i.get("id") for i in ideas}
    for k in kws:
        lab = f"keyword {k.get('id')}"
        if k.get("id") in kids: errors.append(f"{lab}: trùng id")
        kids.add(k.get("id"))
        for f in ("id", "region", "keyword", "theme", "confidence"):
            if not k.get(f): errors.append(f"{lab}: thiếu '{f}'")
        if k.get("region") not in regions: errors.append(f"{lab}: region không hợp lệ: {k.get('region')}")
        if k.get("theme") not in themes: errors.append(f"{lab}: theme không hợp lệ: {k.get('theme')}")
        if kconf and k.get("confidence") not in kconf: errors.append(f"{lab}: confidence không hợp lệ: {k.get('confidence')}")
        if not k.get("derived_from") and k.get("source_id") not in ksrc:
            errors.append(f"{lab}: source_id không tồn tại: {k.get('source_id')}")
        for r in k.get("idea_ids") or []:
            if r not in idea_ids: errors.append(f"{lab}: idea_ids tham chiếu ý tưởng không tồn tại: {r}")
    for k in kws:
        for d in k.get("derived_from") or []:
            if d not in kids: errors.append(f"keyword {k.get('id')}: derived_from không tồn tại: {d}")
        if k.get("derived_from") and len(k["derived_from"]) < 2 and k.get("region") == "GLOBAL":
            warns.append(f"keyword {k.get('id')}: mục GLOBAL nên suy ra từ ≥ 2 từ khóa/vùng")
    for i in ideas:
        for r in i.get("from_keywords") or []:
            if r not in kids: errors.append(f"idea {i.get('id')}: from_keywords không tồn tại: {r}")
    regs_with_kw = {k.get("region") for k in kws}
    unreach = {u.get("region") for u in day.get("keyword_unreachable", [])}
    for r in ("VN", "CN", "KR", "JP", "US"):
        if r not in regs_with_kw and r not in unreach:
            warns.append(f"vùng {r}: không có từ khóa và cũng không ghi nguồn không truy cập được")
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

def validate_toolstack(lab, i):
    errs = []
    ts = i.get("toolstack")
    if not ts:
        return [f"{lab}: thiếu 'toolstack' (bộ công cụ đề xuất)"]
    reg = tool_ids()
    if not DATE_RE.match(str(ts.get("checked", ""))):
        errs.append(f"{lab}: toolstack.checked phải là YYYY-MM-DD")
    if ts.get("confidence") not in CONFIDENCE:
        errs.append(f"{lab}: toolstack.confidence không hợp lệ")
    if not ts.get("wow") or len(ts["wow"]) < 20:
        errs.append(f"{lab}: toolstack.wow thiếu/quá ngắn")
    tools = ts.get("tools") or []
    if not (3 <= len(tools) <= 7):
        errs.append(f"{lab}: toolstack.tools cần 3–7 công cụ (hiện {len(tools)})")
    seen = set()
    for t in tools:
        tid = t.get("tool_id")
        if tid not in reg:
            errs.append(f"{lab}: toolstack tool_id không có trong tools.json: {tid}")
        if tid in seen:
            errs.append(f"{lab}: toolstack trùng tool_id {tid}")
        seen.add(tid)
        for k in ("role", "why"):
            if not t.get(k):
                errs.append(f"{lab}: toolstack/{tid} thiếu '{k}'")
        for a in t.get("alt_ids") or []:
            if a not in reg:
                errs.append(f"{lab}: toolstack/{tid} alt_id không có trong tools.json: {a}")
    allowed = seen | {a for t in tools for a in (t.get("alt_ids") or [])}
    for v in ("budget", "premium"):
        b = ts.get(v) or {}
        if not b.get("tool_ids") or not b.get("monthly_cost_note") or not b.get("tradeoff"):
            errs.append(f"{lab}: toolstack.{v} thiếu tool_ids/monthly_cost_note/tradeoff")
        for k in b.get("tool_ids") or []:
            if k not in reg:
                errs.append(f"{lab}: toolstack.{v} tool_id không có trong tools.json: {k}")
            elif k not in allowed:
                errs.append(f"{lab}: toolstack.{v} dùng {k} nhưng không có trong tools/alt_ids của ý tưởng")
    cp = i.get("claude_prompt") or ""
    for t in tools:
        if t.get("tool_id") in reg and reg[t["tool_id"]]["name"] not in cp:
            errs.append(f"{lab}: claude_prompt chưa nhắc công cụ {reg[t['tool_id']]['name']} của toolstack")
    # ghi chú chi phí chỉ được dùng công cụ có trong registry: cảnh báo nếu nhắc công cụ 'chưa xác minh giá'
    return errs

def validate_tools():
    path = os.path.join(DATA, "tools.json")
    errors, warns = [], []
    if not os.path.exists(path):
        return ["tools.json: không tìm thấy"], {}
    t = load(path)
    for k in ("verified_at", "next_review", "categories", "tools"):
        if not t.get(k):
            errors.append(f"tools: thiếu '{k}'")
    for dk in ("verified_at", "next_review"):
        if t.get(dk) and not DATE_RE.match(t[dk]):
            errors.append(f"tools: '{dk}' sai định dạng")
    if t.get("verified_at") and DATE_RE.match(t["verified_at"]):
        age = (date.today() - date.fromisoformat(t["verified_at"])).days
        if age > 7:
            warns.append(f"tools: đã {age} ngày chưa kiểm lại (quy định: ≤ 7 ngày) — chạy re-verify hàng tuần")
    cats = {c["id"] for c in t.get("categories", [])}
    ids = set()
    for x in t.get("tools", []):
        lab = f"tools/{x.get('id')}"
        if x.get("id") in ids:
            errors.append(f"{lab}: trùng id")
        ids.add(x.get("id"))
        for k in ("id", "name", "category", "url", "summary", "vn_availability", "checked", "how_read", "facts"):
            if not x.get(k):
                errors.append(f"{lab}: thiếu '{k}'")
        if x.get("category") not in cats:
            errors.append(f"{lab}: category không hợp lệ")
        for uk in ("url", "pricing_url"):
            if x.get(uk) and not is_url(x[uk]):
                errors.append(f"{lab}: {uk} không phải URL http(s)")
        if x.get("vn_availability") not in VN_AVAIL:
            errors.append(f"{lab}: vn_availability không hợp lệ")
        if x.get("checked") and not DATE_RE.match(x["checked"]):
            errors.append(f"{lab}: checked sai định dạng")
        for f in x.get("facts", []):
            if f.get("verification") not in VERIFICATION:
                errors.append(f"{lab}: fact verification không hợp lệ: {f.get('verification')}")
            if f.get("verification") == "chưa xác minh" and PRICE_RE.search(f.get("text", "")) and "chưa xác minh" not in f["text"].lower():
                warns.append(f"{lab}: fact 'chưa xác minh' có vẻ chứa giá — nêu rõ là chưa xác minh hoặc bỏ: {f['text'][:70]}")
        if x.get("how_read") and not str(x["how_read"]).startswith(HOW_READ_OPEN) and not any(f.get("verification") == "chưa xác minh" for f in x["facts"]):
            warns.append(f"{lab}: how_read='{x['how_read']}' nhưng không có fact nào 'chưa xác minh' — kiểm tra")
    print(f"== data/tools.json: {len(errors)} lỗi, {len(warns)} cảnh báo")
    for e in errors: print("  ERROR:", e)
    for x in warns: print("  warn :", x)
    return errors, t

def validate_youth(cfg):
    path = os.path.join(DATA, "vn-youth.json")
    errors, warns = [], []
    y = load(path)
    for k in ("title", "verified_at", "next_review", "summary_points", "sections", "caveats"):
        if not y.get(k):
            errors.append(f"vn-youth: thiếu '{k}'")
    for dk in ("verified_at", "next_review"):
        if y.get(dk) and not DATE_RE.match(y[dk]):
            errors.append(f"vn-youth: '{dk}' sai định dạng")
    if y.get("verified_at") and DATE_RE.match(y["verified_at"]):
        age = (date.today() - date.fromisoformat(y["verified_at"])).days
        if age > 7:
            warns.append(f"vn-youth: đã {age} ngày chưa kiểm lại (quy định: ≤ 7 ngày) — cần re-verify hàng tuần")
    seen = set()
    for sec in y.get("sections", []):
        lab = f"vn-youth/{sec.get('id')}"
        check_sources(lab, sec.get("sources", []), sec.get("facts", []), errors, warns)
        for f in sec.get("facts", []):
            for k in ("id", "label"):
                if not f.get(k):
                    errors.append(f"{lab}: fact thiếu '{k}'")
            if f.get("id") in seen:
                errors.append(f"{lab}: trùng fact id {f.get('id')}")
            seen.add(f.get("id"))
    print(f"== data/vn-youth.json: {len(errors)} lỗi, {len(warns)} cảnh báo")
    for e in errors: print("  ERROR:", e)
    for x in warns: print("  warn :", x)
    return errors, y

def check_links(day):
    bad = 0
    urls = {}
    blocks = day.get("trends", []) + day.get("ideas", []) + day.get("sections", []) + [{"sources": day.get("keyword_sources", [])}]
    for blk in blocks:
        for s in blk.get("sources", []):
            urls[s["url"]] = s["id"]
    for tt in day.get("tools", []):
        for uk in ("url", "pricing_url"):
            if tt.get(uk): urls[tt[uk]] = tt["id"]
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
            "idea_count": len(d.get("ideas", [])), "trend_count": len(d.get("trends", [])), "keyword_count": len(d.get("keywords", [])),
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
    ap.add_argument("--youth", action="store_true", help="chỉ kiểm tra data/vn-youth.json")
    ap.add_argument("--tools", action="store_true", help="chỉ kiểm tra data/tools.json")
    a = ap.parse_args()
    cfg = load(os.path.join(DATA, "config.json"))
    w = weights(cfg)
    if a.rebuild_index and not a.file:
        rebuild_index(cfg); return 0
    files = sorted(glob.glob(os.path.join(DATA, "????-??-??.json"))) if a.all else ([a.file] if a.file else [])
    if not files and not a.youth and not a.tools:
        ap.print_help(); return 2
    rc = 0
    if a.youth or a.all:
        yerrs, y = validate_youth(cfg)
        if yerrs: rc = 1
        if a.check_links: check_links(y)
    if a.tools or a.all:
        terrs, tt = validate_tools()
        if terrs: rc = 1
        if a.check_links and tt: check_links(tt)
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
