# DAILY_UPDATE — quy trình cập nhật hằng ngày

Mục tiêu: mỗi ngày thêm **một file `data/YYYY-MM-DD.json`** (ngày theo múi giờ Asia/Saigon, UTC+7) gồm **≥ 8 ý tưởng xếp hạng + ≥ 4 tín hiệu xu hướng đa vùng (Trung Quốc vẫn là trọng tâm; thêm KR/JP/US, và SEA/EU/IN khi có) + bảng từ khóa & chủ đề hot**, dựa trên nghiên cứu thật. **Chất lượng và độ chính xác quan trọng hơn tốc độ.** Không bịa số liệu, không bịa link.

## 1. Quy trình (đúng thứ tự)
0. **Ảnh + `claude_prompt` + `toolstack` cho mọi ý tưởng mới** (mục 8, 9). Nếu `data/tools.json` quá 7 ngày, **kiểm lại công cụ** (mục 9). **Làm mới từ khóa hot** (mục 6) và, nếu `data/vn-youth.json` đã quá 7 ngày, **kiểm lại chân dung giới trẻ** (mục 7).
1. **Nghiên cứu** (mục 2) — tìm xu hướng/tín hiệu *mới trong ~7 ngày*: Trung Quốc (Xinhua, China Daily, 36Kr, TechNode, Pandaily, Yicai, 界面, 人民网…), Hàn (Korea Herald/Times/JoongAng, Yonhap, Sportschosun, Olive Young…), Nhật (Fun Japan, Nikkei, Yahoo Japan realtime…), Mỹ (Z Media/TikTok Shop, Retail Dive, TechCrunch…), SEA/EU/IN khi có. Có thể trùng chủ đề hôm trước nếu có diễn biến mới; không lặp nguyên ý tưởng cũ — xem `data/index.json` để tránh trùng.
2. **Tạo `data/YYYY-MM-DD.json`** theo schema (mục 3). Bắt đầu bằng cách copy file ngày gần nhất làm khung.
3. **Kiểm tra & tính điểm:** `python3 scripts/add_day.py data/YYYY-MM-DD.json --fix`
   (xác thực schema, tính lại `total_score`, `rank`, ghi lại file và **dựng lại `data/index.json`**). Sửa mọi lỗi/cảnh báo, chạy lại tới khi sạch.
4. **Kiểm link:** `python3 scripts/add_day.py data/YYYY-MM-DD.json --check-links`. Link lỗi → mở lại bằng trình duyệt; nếu trang chặn bot (403/444) thì ghi rõ trong `note` của nguồn, không xoá lặng lẽ.
   (Lưu ý: một số trang TQ như ce.cn, zgyww.cn có thể không truy cập được từ máy chủ ngoài TQ → WARN URLError; hãy mở bằng WebFetch/trình duyệt để xác nhận.)
5. **Xem thử local** (`python3 -m http.server`) — kiểm tra tab *Hôm nay*, bộ lọc vùng, tab *Từ khóa*, *Giới trẻ*, tìm kiếm, mobile 390px & desktop, không lỗi console.
6. **Commit + push:**
   ```
   git add data/ && git commit -m "daily: YYYY-MM-DD" && git push
   ```
   GitHub Pages tự cập nhật sau ~1 phút. Dữ liệu `data/*.json` được tải network-first nên **không cần** đổi `VERSION` của service worker. **Chỉ** tăng `VERSION` trong `sw.js` khi sửa `index.html`, `css/`, `js/`, `icons/`, `manifest`.
7. Xác minh trang live trả 200 và ngày mới xuất hiện ở *Hôm nay* với huy hiệu *MỚI HÔM NAY*.

## 2. Kỷ luật nghiên cứu (bắt buộc)
- **Mở trang nguồn thật** (WebFetch/trình duyệt) và đọc; không dựa vào snippet tìm kiếm. Nếu chỉ đọc được snippet/trang bị chặn: `how_read` = `"tìm kiếm (snippet)"` + ghi `note` lý do.
- **≥ 2 nguồn độc lập** cho mỗi dữ kiện quan trọng khi có thể (không tính 2 bài chép lại cùng một nguồn gốc). Số liệu chỉ có một nguồn → `verification: "1 nguồn gốc"`. Không tìm được → `"chưa xác minh"` và đừng dùng làm căn cứ chính.
- Mỗi nguồn ghi đủ: `id`, `name`, `title`, `url`, `published` (YYYY-MM-DD), `accessed` (ngày thực mở), `how_read`, `note` (nếu cần).
- **Đối chiếu số liệu**: đúng con số, đơn vị, kỳ (YoY/MoM), tiền tệ, ngày; chép đúng phạm vi (ví dụ “giá trị” ≠ “số lượng”). Không làm tròn/“thổi” số.
- **Phần áp dụng cho Việt Nam gần như luôn là giả thuyết** → `hypothesis: true` + `hypothesis_note` nói rõ cái gì có nguồn, cái gì chưa. Cần khảo sát đối thủ VN (tìm thật) và ghi cả đối thủ đã tồn tại; **đánh giá trung thực độ mới lạ** (đã có người làm → điểm `novelty` thấp).
- Vốn: ước tính của người soạn phải ghi `capital.note` nêu cơ sở; USD quy đổi theo `usd_vnd_rate` trong `data/config.json` (script kiểm tra). Cập nhật tỷ giá trong config nếu lệch đáng kể, kèm nguồn.
- Ý tưởng “Cơ hội đầu tư”: chỉ là watchlist/phân tích, **không phải khuyến nghị đầu tư**; nêu quan điểm trái chiều nếu có.
- **Đối chiếu điểm** trước khi chốt: điểm từng tiêu chí có khớp bằng chứng? (ví dụ `signal` 9–10 chỉ khi ≥2 nguồn độc lập; `vnfit` ≥ 8 chỉ khi dẫn ≥ 2 dữ kiện đã xác minh ở `vn-youth.json` — dữ kiện “chưa xác minh” **không** được dùng làm căn cứ chấm điểm; `novelty` cao chỉ khi đã tìm đối thủ VN mà không thấy; `lowcap` khớp `capital`; `ease` khớp các bước tuần đầu). Xếp hạng nhìn lại có hợp lý không.
- **Tín hiệu đa vùng**: mỗi xu hướng/ý tưởng có `regions` (CN/KR/JP/US/SEA/EU/IN). Khi hai bài báo cùng chép từ một hãng tin (vd. Yonhap) thì **không** tính là 2 nguồn độc lập — ghi rõ trong `note`. Ý tưởng không có tín hiệu nước ngoài (chỉ dựa nhu cầu VN) phải có `signal` thấp và nói thẳng.
- Rà lần cuối: JSON hợp lệ, tiếng Việt có dấu, không trùng id, mọi `source_ids` tồn tại, link mở được.

## 3. Schema `data/YYYY-MM-DD.json`
```
{
  "date": "YYYY-MM-DD",
  "generated_at": "ISO-8601 +07:00",
  "headline": "tiêu đề 1 dòng",
  "summary": "2–4 câu tóm tắt ngày",
  "trends": [ ≥ 4 × {
      "id": "YYYYMMDD-tN-slug", "title", "summary", "why_it_matters", "tags": [..],
      "regions": ["CN"|"KR"|"JP"|"US"|"SEA"|"EU"|"IN"|…],   // bắt buộc; cảnh báo nếu không có tín hiệu CN hoặc < 3 vùng
      "key_facts": [ { "text", "source_ids": [..], "verification": "2+ nguồn độc lập" | "1 nguồn gốc" | "chưa xác minh", "note"? } ],
      "sources": [ { "id","name","title","url","published","accessed","how_read","note"? } ] } ],
  "ideas": [ ≥ 8 × {
      "id": "YYYYMMDD-NN-slug", "title", "pitch",
      "type": "startup" | "invest",
      "category": ["ai"|"ecom"|"product"|"service"|"content"|"fnb"|"b2b"|"invest", ...],
      "tags": [..],
      "hypothesis": true|false, "hypothesis_note": "(bắt buộc nếu hypothesis)", "confidence": "thấp|trung bình|cao",
      "image": "assets/ideas/<id>.webp", "image_alt": "mô tả ảnh (≥15 ký tự)",
      "claude_prompt": "prompt tiếng Việt để dán vào Claude (mục 8)",
      "toolstack": { "checked": "YYYY-MM-DD", "confidence": "…", "wow": "1 câu 'wow'",
          "tools": [ 3–7 × { "tool_id": "id trong data/tools.json", "role", "why", "alt_ids": [..], "alt_note"? } ],
          "budget": { "tool_ids": [..], "monthly_cost_note", "tradeoff" }, "premium": { …như budget… } },   // mục 9
      "regions": ["CN", "KR", …],
      "signal_text": "tín hiệu quốc tế (có số liệu + ngày)",
      "vn_youth_fit": "vì sao hợp/không hợp hành vi giới trẻ VN (có trích dữ kiện)",
      "vn_fit_refs": ["id dữ kiện trong data/vn-youth.json", …],
      "from_keywords": ["kw-…"],   // tuỳ chọn: ý tưởng sinh ra từ từ khóa hot
      "key_facts": [ như trên ], "sources": [ như trên ],
      "localize_vn": "áp dụng cho VN (nêu rõ giả thuyết)", "localize_global": "(tuỳ chọn)",
      "first_steps": ["Ngày 1–2: …", … (kế hoạch 1 tuần)],
      "capital": { "vnd_min_m", "vnd_max_m" (triệu VND), "usd_min", "usd_max", "note" },
      "risks": [..],
      "scores": { "ease","demand","novelty","lowcap","signal","vnfit" }   // số nguyên 1–10
      // "total_score" và "rank" do script tính (--fix) — đừng nhập tay
  } ],
  "keywords": [ {                       // mục 6
      "id": "kw-<vùng>-NN", "region": "VN|CN|KR|JP|US|GLOBAL|…", "rank": 7 | null, "keyword", "gloss": "dịch/giải thích VN",
      "theme": "<id trong config.keyword_themes>", "source_id": "<id trong keyword_sources>",   // GLOBAL: thay bằng "derived_from": [id từ khóa]
      "confidence": "bảng xếp hạng gốc (đo trực tiếp)" | "tổng hợp bởi bên thứ ba" | "suy ra từ nhiều vùng" | "chưa xác minh",
      "metric", "note", "idea_ids": [id ý tưởng liên quan] } ],
  "keyword_sources": [ { "id","name","title","url","published","accessed","captured_at" (ISO +07:00),"how_read","region","note" } ],
  "keyword_unreachable": [ { "region", "source", "reason" } ]
}
```
`data/index.json` do script dựng (`--rebuild-index`) — không sửa tay.

## 4. Chấm điểm
`total_score = Σ (điểm × trọng số)`, thang 10, làm tròn 2 chữ số. Trọng số (trong `data/config.json`, hiển thị ở tab *Phương pháp*):

| Tiêu chí | Khoá | Trọng số |
|---|---|---|
| Độ dễ thực hiện | ease | 0,18 |
| Nhu cầu thị trường | demand | 0,22 |
| Độ mới lạ | novelty | 0,12 |
| Vốn thấp | lowcap | 0,16 |
| Tín hiệu quốc tế (CN/KR/JP/US…) | signal | 0,14 |
| Hợp hành vi giới trẻ VN | vnfit | 0,18 |

`rank`: `total_score` giảm dần → `signal` giảm dần → `demand` giảm dần → `id`. Mức vốn (lọc) suy ra từ `vnd_max_m`: ≤10 / ≤50 / ≤200 / >200 triệu. Mức khó suy ra từ `ease`: ≥7 dễ, 5–6 vừa, ≤4 khó hơn. Nếu đổi trọng số: sửa `config.json`, chạy `python3 scripts/add_day.py --all --fix`, tăng `VERSION` trong `sw.js`. (Ý tưởng cũ đã được chuyển `china` → `signal` và thêm `vnfit` ở bản v1.1.0.)

## 5. Lệnh hữu ích
```
python3 scripts/add_day.py data/YYYY-MM-DD.json            # chỉ kiểm tra
python3 scripts/add_day.py data/YYYY-MM-DD.json --fix      # tính điểm/hạng + dựng index
python3 scripts/add_day.py --rebuild-index                 # dựng lại index
python3 scripts/add_day.py --youth                         # kiểm data/vn-youth.json
python3 scripts/add_day.py --tools [--check-links]         # kiểm data/tools.json (≤ 7 ngày, nhãn xác minh, url)
python3 scripts/add_day.py --all --check-links             # kiểm toàn bộ file (gồm vn-youth.json, tools.json) + link
```

## 6. Làm mới tab *Từ khóa & chủ đề hot* (mỗi ngày)
Mục tiêu: ảnh chụp **thật** các từ khóa đang nổi theo vùng, ghi `rank`, nguồn, `captured_at` (giờ UTC+7), độ tin cậy. **Không bịa**: nguồn nào không lấy được thì ghi vào `keyword_unreachable` với lý do và ngày thử.

| Vùng | Nguồn đã dùng được (25/10/2026) | Cách lấy |
|---|---|---|
| VN, KR, JP, US | Google Trends RSS (10 mục/vùng; `pubDate` dạng -0700 → đổi sang UTC+7) | `curl 'https://trends.google.com/trending/rss?geo=VN'` (đổi `geo=KR|JP|US`) |
| CN | Baidu 热搜 | `curl -s -A 'Mozilla/5.0' 'https://top.baidu.com/board?tab=realtime'` → đọc khối `<!--s-data:{…}-->`, trường `hotList` (`word`, `hotScore`) |
| JP | Yahoo! JAPAN リアルタイム検索 (まとめ) | `curl` trang `https://search.yahoo.co.jp/realtime/search/matome` → JSON `__NEXT_DATA__` → `pageProps.pageData.matomeRanking.items` |
| US | Z Media *TikTok Shop Index* (top sản phẩm) | mở trang tháng hiện tại bằng WebFetch |
| KR/JP/US | tổng hợp bên thứ ba (issueitnow *Trending in Korea*, Fun Japan, Sportschosun, Korea Herald, SellBridge) | mở trang; gán `confidence: "tổng hợp bởi bên thứ ba"` |
| VN | Google Trends VN + tin VietnamPlus/Vietnamnet về xu hướng tiêu dùng | mở trang |

**Đã thử nhưng không lấy được (thử lại mỗi ngày — có thể đổi):** Weibo 热搜 (chuyển sang đăng nhập khách), Douyin/Xiaohongshu (cần đăng nhập/JS), Shopee/Lazada/TikTok Shop VN trending (JS shell), Naver DataLab/Daum (không có bảng realtime công khai), Amazon Movers & Shakers (JS shell), TikTok Creative Center (JS shell). Chỉ bỏ khỏi `keyword_unreachable` khi thực sự lấy được dữ liệu.

Quy tắc:
- Giữ **hạng thật** của nguồn; chỉ chọn các mục có ý nghĩa (loại trừ tin nhạy cảm/ kết quả thể thao nếu không có góc thương mại — hoặc giữ nhưng gán chủ đề `sport`/`society`, không gắn ý tưởng).
- Gắn `theme` (config.keyword_themes: beauty, food, fashion, tech, collect, ent, travel, money, work, sport, society, home) và `gloss` tiếng Việt (dịch trung thực).
- Từ khóa `GLOBAL` chỉ **suy ra** từ ≥ 2 từ khóa/vùng khác (`derived_from`, `confidence: "suy ra từ nhiều vùng"`), không tự nhận là số liệu đo.
- Chủ đề có tiềm năng thương mại → thêm vào `idea_ids`; nếu sinh ý tưởng mới từ từ khóa → đặt `from_keywords` ở ý tưởng. `add_day.py` kiểm tham chiếu chéo.
- Chạy `python3 scripts/add_day.py data/YYYY-MM-DD.json --fix` — sẽ báo lỗi nếu region/theme/source_id/idea_ids sai.

## 7. Chân dung giới trẻ VN (`data/vn-youth.json`) — kiểm lại hằng tuần
- Mỗi dữ kiện: `id`, `label`, `text`, `source_ids`, `verification`, `note`; mỗi nguồn: `url`, `published`, `accessed`, `how_read`.
- Kiểm lại ≥ mỗi 7 ngày (`next_review`): mở lại nguồn gốc, cập nhật số liệu mới (báo cáo e-Conomy SEA, Metric, Decision Lab, GSO/Tổng cục Thống kê, MCST…), cập nhật `verified_at`/`next_review`, rồi `python3 scripts/add_day.py --youth` (và `--all`). `--all` cảnh báo nếu `verified_at` quá 7 ngày.
- Dữ kiện chỉ có snippet (không mở được trang) → `verification: "chưa xác minh"`, **không** dùng để chấm `vnfit`.
- Khi dữ kiện đổi: rà các ý tưởng có `vn_fit_refs` trỏ tới dữ kiện đó (điểm `vnfit` có còn đúng không).

## 8. Ảnh minh họa & `claude_prompt` cho MỖI ý tưởng (bắt buộc — script báo lỗi nếu thiếu)
**Ảnh:** 1 ảnh/ý tưởng, lưu `assets/ideas/<id>.webp`, 800×600, ≤ 150KB (`add_day.py` kiểm), `image_alt` mô tả đúng nội dung. Tạo bằng công cụ tạo ảnh (hoặc SVG sạch nếu không có); phong cách phẳng, bảng màu teal/cam thống nhất; **không có chữ, không logo/thương hiệu, không người thật, không nhân vật có bản quyền**; không lấy ảnh từ web. Chuyển ảnh sang webp: `Image.open(f).convert('RGB').resize((800,600)).save(out,'WEBP',quality=80,method=6)` (Pillow). Có thêm ảnh/asset mới ⇒ tăng `VERSION` trong `sw.js` nếu đổi shell; ảnh mới được cache-first ở `bh-img-v1` nên không cần đổi version chỉ vì thêm ảnh ngày mới.

**`claude_prompt`** (1.500–12.000 ký tự, tiếng Việt, tự đủ ý — người dùng dán thẳng vào Claude). Cấu trúc bắt buộc, các tiêu đề `## 1.` … `## 8.`:
1. Ý tưởng & mục tiêu (chứa nguyên tên ý tưởng; mục tiêu tuần: kiểm chứng nhu cầu thật ở VN, quyết định đi tiếp/điều chỉnh/dừng bằng số liệu).
2. Tín hiệu đã có nguồn — chép từ `signal_text` + `key_facts` (kèm mức xác minh) + `hypothesis_note`; dặn Claude **không tự thêm số liệu/thương hiệu/nguồn**.
3. Khách hàng mục tiêu (giới trẻ VN): `vn_youth_fit` + `localize_vn` (nhắc đây là giả thuyết).
4. Ràng buộc: vốn từ `capital`, thị trường VN, thanh toán kiểu Việt, pháp lý/tuân thủ đặc thù (nêu ‘cần xác minh’ thay vì khẳng định điều luật), `risks`.
5. Kế hoạch MVP 1 tuần: `first_steps` làm bản nháp để Claude rà soát và gán theo ngày.
6. Sản phẩm Claude PHẢI tạo — **tuỳ biến theo ý tưởng** (vd. phim ngắn AI: kịch bản, quy trình nhất quán nhân vật, công cụ, lịch đăng, kiếm tiền; sản phẩm số: đặc tả + mã nguồn chạy được + hướng dẫn triển khai; hàng hóa: tin nhắn nhà cung cấp, bảng giá vốn–giá bán, trang pre-order, lịch nội dung, kịch bản video; đầu tư: khung watchlist, kịch bản, KHÔNG khuyến nghị).
7. Cách làm việc: chỉ hỏi ≤ 3 câu nếu thật sự cần; không bịa; đánh dấu ‘[cần xác minh]’; phân biệt dữ kiện có nguồn / giả định / việc tôi cần tự kiểm tra.
8. Định dạng đầu ra (tóm tắt + giả định → bảng 7 ngày → từng sản phẩm → chỉ số & ngưỡng quyết định → 5 rủi ro).

Quy tắc: không chèn số liệu ngoài dữ liệu có nguồn của ý tưởng — `add_day.py` cảnh báo mọi số > 20 trong prompt mà không có trong `title/pitch/signal_text/key_facts/vn_youth_fit/localize_vn/first_steps/capital/risks`. 18 prompt của ngày 2026-10-25 là mẫu tham chiếu (xem `data/2026-10-25.json`). UI hiển thị số ký tự và nút **Copy prompt** (thẻ + mục *Triển khai*).

## 9. Bộ công cụ (`toolstack`) & `data/tools.json` — kiểm lại hằng tuần (bắt buộc)
**Kiến trúc:** `data/tools.json` là *registry* duy nhất cho giá/tính năng/khả dụng ở VN; mỗi ý tưởng chỉ tham chiếu `tool_id` (không chép giá vào ý tưởng) nên cập nhật hằng tuần ở một chỗ. Mỗi tool: `id, name, category, url, pricing_url, summary, facts[{text, verification}], vn_availability, vn_note, vi_support, how_read, checked`.

**Quy trình kiểm lại (mỗi 7 ngày hoặc trước khi dùng công cụ mới):**
1. **Mở trang chính thức** của từng công cụ (trang giá + docs) — không dùng blog/bên thứ ba cho giá. Ghi `how_read` = `mở trang (…)`; ghi ngày vào `checked`; cập nhật `verified_at`/`next_review` ở đầu file.
2. **Không mở/đọc được** (chặn bot, JS-only, 403, trang trống) ⇒ fact ghi `verification: "chưa xác minh"`, **KHÔNG nêu giá/tính năng**, `how_read` ghi rõ lý do. Thử lại bằng `curl` rồi trình duyệt trước khi bỏ cuộc. Giá chỉ đọc được từ bên thứ ba ⇒ ghi “Chưa xác minh: …” và nêu rõ nguồn.
3. **Không bịa model/tính năng**: chỉ ghi tên model/tính năng xuất hiện trên trang chính thức vừa mở. Ví dụ: Seedance — chỉ giá token của BytePlus hoặc dòng giá của CapCut; quy đổi $/giây từ trang bên thứ ba là “chưa xác minh”.
4. **Khả dụng ở VN:** `vn_availability = "đã xác minh"` CHỈ khi trang chính thức liệt kê Việt Nam (hoặc dịch vụ của VN: VietQR, payOS, Zalo, TikTok Shop VN); còn lại `chưa xác minh`; có giới hạn đã biết ⇒ `có hạn chế` + ghi `vn_note`. Ghi giới hạn thương mại (gói Free không cho dùng thương mại, GitHub Pages không dành cho trang thanh toán…).
5. **Mức xác minh** dùng đúng 3 nhãn như phần còn lại: `2+ nguồn độc lập` / `1 nguồn gốc` / `chưa xác minh`. Giá niêm yết USD/€ chưa gồm thuế; ghi chú nếu hiển thị theo vùng.
6. Chạy `python3 scripts/add_day.py --tools --check-links`, rồi `--all --fix`. Giá đổi ⇒ cập nhật lại `monthly_cost_note` của các `toolstack` bị ảnh hưởng (chi phí chỉ cộng từ giá đã xác minh; phần chưa xác minh phải ghi “giá chưa xác minh”).

**Mỗi ý tưởng mới BẮT BUỘC có `toolstack`** (script báo lỗi nếu thiếu): 3–7 công cụ, mỗi công cụ có `role` (làm gì trong *ý tưởng này*) + `why` (vì sao hợp, kèm `alt_ids` thay thế); `wow` (1 câu); `budget` (rẻ nhất khả thi) và `premium`; mọi `tool_id` phải có trong `tools.json` (cần công cụ mới ⇒ thêm vào registry kèm nghiên cứu như trên, không đoán); `budget/premium.tool_ids` ⊆ tools + `alt_ids` của ý tưởng. **`claude_prompt` phải nhắc đúng tên các công cụ đó** (mục 4 *Ràng buộc* — tên + vai trò, KHÔNG giá) để Claude dùng đúng bộ công cụ; script kiểm điều này. Chọn công cụ theo ý tưởng, không dùng một bộ cho tất cả; ưu tiên công cụ có kênh dùng được ở VN và nhắc rõ khi cần thẻ quốc tế/VPN.
