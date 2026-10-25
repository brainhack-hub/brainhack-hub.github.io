# 💡 brain-hack

Trung tâm **ý tưởng kinh doanh mỗi ngày** (tiếng Việt) — mỗi ngày 8 ý tưởng xếp hạng + 4–6 tín hiệu xu hướng Trung Quốc, kèm nguồn đã mở và mức xác minh. Là một **PWA** cài được lên màn hình chính điện thoại/máy tính.

**Mở app:** https://formalboy.github.io/brain-hack/

## Tính năng
- **Hôm nay**: ngày rõ ràng, huy hiệu *MỚI HÔM NAY*, các thẻ ý tưởng xếp hạng, mục *Xu hướng Trung Quốc hôm nay* (có link nguồn).
- **Xếp hạng**: bảng xếp hạng tổng hợp mọi ngày. **Lưu trữ**: duyệt theo ngày.
- Lọc theo danh mục (AI, TMĐT/DTC, sản phẩm tiêu dùng, dịch vụ, nội dung/MXH, F&B, B2B, đầu tư/xu hướng), loại (Khởi nghiệp nhỏ / Cơ hội đầu tư), mức vốn, mức độ khó; sắp xếp theo điểm; tìm kiếm.
- ⭐ gắn sao + trạng thái (quan tâm / đang thử / bỏ qua) lưu trong `localStorage` (có xuất/nhập JSON ở tab *Đã lưu*).
- Sáng/tối, offline (service worker, cache có phiên bản; `data/*.json` ưu tiên mạng).

## Cấu trúc
```
index.html, css/, js/app.js     giao diện (vanilla, không build)
sw.js, manifest.webmanifest     PWA (đổi VERSION trong sw.js khi sửa code/icon)
icons/                          icon PWA
data/config.json                trọng số, danh mục, mức vốn, tỷ giá
data/YYYY-MM-DD.json            dữ liệu từng ngày
data/index.json                 chỉ mục (do script dựng — đừng sửa tay)
scripts/add_day.py              kiểm tra + tính điểm/hạng + dựng index
DAILY_UPDATE.md                 quy trình cập nhật hằng ngày (đọc kỹ)
```

## Chạy thử local
```
python3 -m http.server 8000     # rồi mở http://localhost:8000/
python3 scripts/add_day.py --all --check-links
```

## Chấm điểm
5 tiêu chí 1–10, **tổng = Σ điểm × trọng số** (thang 10): dễ làm 0,20 · nhu cầu 0,25 · mới lạ 0,15 · vốn thấp 0,20 · tín hiệu Trung Quốc 0,20. Hạng: tổng giảm dần → tín hiệu TQ → nhu cầu → id. Chi tiết ở tab *Phương pháp* và `DAILY_UPDATE.md`.

## Lưu ý
Nội dung chỉ để tham khảo, **không phải tư vấn đầu tư/pháp lý**. Dữ liệu Trung Quốc có dẫn nguồn; phần áp dụng cho Việt Nam thường là **giả thuyết** cần test. Tỷ giá USD/VND chỉ là ước lượng (xem `data/config.json`).
