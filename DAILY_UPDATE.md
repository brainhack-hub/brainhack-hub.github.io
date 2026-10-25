# DAILY_UPDATE — quy trình cập nhật hằng ngày

Mục tiêu: mỗi ngày thêm **một file `data/YYYY-MM-DD.json`** (ngày theo múi giờ Asia/Saigon, UTC+7) gồm **8 ý tưởng xếp hạng + 4–6 tín hiệu xu hướng Trung Quốc**, dựa trên nghiên cứu thật. **Chất lượng và độ chính xác quan trọng hơn tốc độ.** Không bịa số liệu, không bịa link.

## 1. Quy trình (đúng thứ tự)
1. **Nghiên cứu** (mục 2) — tìm xu hướng/tín hiệu *mới trong ~7 ngày* (ưu tiên nguồn tiếng Trung + Anh: Xinhua, China Daily, 36Kr, TechNode, Pandaily, Yicai, 界面, 人民网, báo địa phương…). Có thể trùng chủ đề hôm trước nếu có diễn biến mới; không lặp nguyên ý tưởng cũ — xem `data/index.json` để tránh trùng.
2. **Tạo `data/YYYY-MM-DD.json`** theo schema (mục 3). Bắt đầu bằng cách copy file ngày gần nhất làm khung.
3. **Kiểm tra & tính điểm:** `python3 scripts/add_day.py data/YYYY-MM-DD.json --fix`
   (xác thực schema, tính lại `total_score`, `rank`, ghi lại file và **dựng lại `data/index.json`**). Sửa mọi lỗi/cảnh báo, chạy lại tới khi sạch.
4. **Kiểm link:** `python3 scripts/add_day.py data/YYYY-MM-DD.json --check-links`. Link lỗi → mở lại bằng trình duyệt; nếu trang chặn bot (403/444) thì ghi rõ trong `note` của nguồn, không xoá lặng lẽ.
   (Lưu ý: một số trang TQ như ce.cn, zgyww.cn có thể không truy cập được từ máy chủ ngoài TQ → WARN URLError; hãy mở bằng WebFetch/trình duyệt để xác nhận.)
5. **Xem thử local** (`python3 -m http.server`) — kiểm tra tab *Hôm nay*, lọc, tìm kiếm, không lỗi console.
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
- **Đối chiếu điểm** trước khi chốt: điểm từng tiêu chí có khớp bằng chứng? (ví dụ `china` 9–10 chỉ khi ≥2 nguồn độc lập; `novelty` cao chỉ khi đã tìm đối thủ VN mà không thấy; `lowcap` khớp `capital`; `ease` khớp các bước tuần đầu). Xếp hạng nhìn lại có hợp lý không.
- Rà lần cuối: JSON hợp lệ, tiếng Việt có dấu, không trùng id, mọi `source_ids` tồn tại, link mở được.

## 3. Schema `data/YYYY-MM-DD.json`
```
{
  "date": "YYYY-MM-DD",
  "generated_at": "ISO-8601 +07:00",
  "headline": "tiêu đề 1 dòng",
  "summary": "2–4 câu tóm tắt ngày",
  "trends": [ 4–6 × {
      "id": "YYYYMMDD-tN-slug", "title", "summary", "why_it_matters", "tags": [..],
      "key_facts": [ { "text", "source_ids": [..], "verification": "2+ nguồn độc lập" | "1 nguồn gốc" | "chưa xác minh", "note"? } ],
      "sources": [ { "id","name","title","url","published","accessed","how_read","note"? } ] } ],
  "ideas": [ 8 × {
      "id": "YYYYMMDD-NN-slug", "title", "pitch",
      "type": "startup" | "invest",
      "category": ["ai"|"ecom"|"product"|"service"|"content"|"fnb"|"b2b"|"invest", ...],
      "tags": [..],
      "hypothesis": true|false, "hypothesis_note": "(bắt buộc nếu hypothesis)", "confidence": "thấp|trung bình|cao",
      "china_signal": "tín hiệu TQ (có số liệu + ngày)",
      "key_facts": [ như trên ], "sources": [ như trên ],
      "localize_vn": "áp dụng cho VN (nêu rõ giả thuyết)", "localize_global": "(tuỳ chọn)",
      "first_steps": ["Ngày 1–2: …", … (kế hoạch 1 tuần)],
      "capital": { "vnd_min_m", "vnd_max_m" (triệu VND), "usd_min", "usd_max", "note" },
      "risks": [..],
      "scores": { "ease","demand","novelty","lowcap","china" }   // số nguyên 1–10
      // "total_score" và "rank" do script tính (--fix) — đừng nhập tay
  } ]
}
```
`data/index.json` do script dựng (`--rebuild-index`) — không sửa tay.

## 4. Chấm điểm
`total_score = Σ (điểm × trọng số)`, thang 10, làm tròn 2 chữ số. Trọng số (trong `data/config.json`, hiển thị ở tab *Phương pháp*):

| Tiêu chí | Khoá | Trọng số |
|---|---|---|
| Độ dễ thực hiện | ease | 0,20 |
| Nhu cầu thị trường | demand | 0,25 |
| Độ mới lạ | novelty | 0,15 |
| Vốn thấp | lowcap | 0,20 |
| Tín hiệu từ Trung Quốc | china | 0,20 |

`rank`: `total_score` giảm dần → `china` giảm dần → `demand` giảm dần → `id`. Mức vốn (lọc) suy ra từ `vnd_max_m`: ≤10 / ≤50 / ≤200 / >200 triệu. Mức khó suy ra từ `ease`: ≥7 dễ, 5–6 vừa, ≤4 khó hơn. Nếu đổi trọng số: sửa `config.json`, chạy `python3 scripts/add_day.py --all --fix`, tăng `VERSION` trong `sw.js`.

## 5. Lệnh hữu ích
```
python3 scripts/add_day.py data/YYYY-MM-DD.json            # chỉ kiểm tra
python3 scripts/add_day.py data/YYYY-MM-DD.json --fix      # tính điểm/hạng + dựng index
python3 scripts/add_day.py --rebuild-index                 # dựng lại index
python3 scripts/add_day.py --all --check-links             # kiểm toàn bộ file + link
```
