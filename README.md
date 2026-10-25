# 💡 brain-hack

Trung tâm **ý tưởng kinh doanh mỗi ngày** (tiếng Việt) — mỗi ngày các ý tưởng xếp hạng + tín hiệu xu hướng **Trung Quốc (trọng tâm), Hàn, Nhật, Mỹ, Đông Nam Á, châu Âu** + bảng **từ khóa & chủ đề hot theo vùng**, được chấm theo độ hợp **hành vi giới trẻ Việt Nam**; mọi dữ kiện kèm nguồn đã mở và mức xác minh. Là một **PWA** cài được lên màn hình chính điện thoại/máy tính.

**Mở app:** https://brainhack-hub.github.io/

## Tính năng
- **Hôm nay**: ngày rõ ràng, huy hiệu *MỚI HÔM NAY*, các thẻ ý tưởng xếp hạng (có cờ vùng tín hiệu 🇨🇳🇰🇷🇯🇵🇺🇸…), mục *Xu hướng thế giới hôm nay* (có link nguồn). Bộ lọc **Vùng tín hiệu** lọc cả ý tưởng lẫn xu hướng.
- **Ảnh minh họa mỗi ý tưởng** (`assets/ideas/<id>.webp`, ≤150KB, có alt): thumbnail trên thẻ, ảnh lớn khi mở chi tiết; tải lười, cache bởi service worker (cache riêng `bh-img-v1`).
- **🤖 Copy prompt** (mục *Triển khai*): mỗi ý tưởng có `claude_prompt` tiếng Việt tự đủ ý (bối cảnh, tín hiệu có nguồn, khách hàng giới trẻ VN, kế hoạch MVP 1 tuần, sản phẩm Claude phải tạo, ràng buộc, định dạng đầu ra); nút Copy dùng Clipboard API, có phương án dự phòng và thông báo, hiển thị số ký tự.
- **🧰 Bộ công cụ đề xuất** (mỗi ý tưởng, mục *Chi tiết*): 3–7 công cụ (LLM, ảnh, video, giọng, nhạc, 3D, dev/hosting, tự động hóa, bán hàng, thanh toán QR, Zalo…) — mỗi công cụ có vai trò trong ý tưởng, lý do chọn + phương án thay thế, ghi chú giá/free-tier kèm ngày kiểm, link trang chính thức, nhãn *khả dụng ở VN* và nhãn mức xác minh; dòng **Wow**; hai biến thể **Tiết kiệm** vs **Cao cấp** với chi phí chỉ cộng từ giá đã xác minh. Thẻ có hàng chip công cụ (bấm để lọc); bộ lọc & ô tìm kiếm có **Công cụ**; tab **🧰 Công cụ** (`#/cong-cu`) là danh mục đầy đủ (`data/tools.json`). Công cụ không mở được trang chính thức ghi **chưa xác minh và không nêu giá**.
- **🔥 Từ khóa** (`#/tu-khoa`): từ khóa/chủ đề hot theo vùng (VN, CN, KR, JP, US, toàn cầu) — mỗi mục có hạng, nguồn, giờ chụp, độ tin cậy, nhóm theo chủ đề, nối tới ý tưởng; lọc theo vùng/chủ đề; liệt kê nguồn **không truy cập được** (không bịa).
- **🧑 Giới trẻ** (`#/gioi-tre`): *Chân dung giới trẻ Việt Nam* — 22 dữ kiện có nguồn/ngày truy cập/mức xác minh; mỗi ý tưởng có mục *Phù hợp hành vi giới trẻ VN* trỏ về đúng dữ kiện.
- **📰 Đọc báo** (`#/doc-bao`): tin công nghệ, chuỗi cung ứng/vật tư và đặc biệt **AI trong xây dựng & phát triển bất động sản** (cả Việt Nam). Mỗi ngày có *Tóm tắt 5 điều cần biết hôm nay*, danh sách nhóm theo chủ đề (AI-xây-dựng / Chuỗi cung ứng / Công nghệ / VN-thị trường), lọc theo chủ đề/vùng/nguồn/trạng thái, tìm kiếm (toàn bộ các ngày), kho lưu trữ theo ngày, đánh dấu **đã đọc / chưa đọc** và **lưu** (localStorage `bh.news.v1`), nút **Mở bài gốc** (`target=_blank rel="noopener noreferrer"`). Mỗi tin có tóm tắt tiếng Việt do người soạn viết sau khi mở bài gốc, nhãn *mức đã đọc* (đọc đầy đủ / đọc một phần / chỉ đọc đoạn trích / chỉ đọc tiêu đề), loại nguồn (tin độc lập, thông cáo nhà cung cấp, ý kiến, khảo sát…), mục *Vì sao quan trọng với đấu thầu/mua sắm* (ghi rõ là phân tích), và danh sách nguồn không mở được. Dữ liệu: `data/news/YYYY-MM-DD.json`, kiểm bằng `scripts/add_news.py`.
- **Xếp hạng**: bảng xếp hạng tổng hợp mọi ngày. **Lưu trữ**: duyệt theo ngày.
- Lọc theo danh mục (AI, TMĐT/DTC, sản phẩm tiêu dùng, dịch vụ, nội dung/MXH, F&B, B2B, đầu tư/xu hướng), loại (Khởi nghiệp nhỏ / Cơ hội đầu tư), mức vốn, mức độ khó; sắp xếp theo điểm; tìm kiếm.
- ⭐ gắn sao + trạng thái (quan tâm / đang thử / bỏ qua) lưu trong `localStorage` (có xuất/nhập JSON ở tab *Đã lưu*).
- Sáng/tối, offline (service worker, cache có phiên bản; `data/*.json` — gồm `data/news/*.json` — ưu tiên mạng).

## Cấu trúc
```
index.html, css/, js/app.js     giao diện (vanilla, không build)
sw.js, manifest.webmanifest     PWA (đổi VERSION trong sw.js khi sửa code/icon)
icons/                          icon PWA
assets/ideas/                   ảnh minh họa từng ý tưởng (webp ≤150KB)
data/config.json                tiêu chí & trọng số, vùng, chủ đề từ khóa, danh mục, mức vốn, tỷ giá
data/vn-youth.json              chân dung giới trẻ VN (kiểm lại hằng tuần: add_day.py --youth)
data/tools.json                 danh mục công cụ + giá/tính năng đã kiểm với trang chính thức (kiểm lại hằng tuần: add_day.py --tools)
data/YYYY-MM-DD.json            dữ liệu từng ngày (trends, ideas, keywords, keyword_sources, keyword_unreachable)
data/index.json                 chỉ mục (do script dựng — đừng sửa tay)
data/news/YYYY-MM-DD.json       tin "Đọc báo" từng ngày (digest 5 điểm, items, unreachable)
data/news/index.json            chỉ mục tin (do add_news.py dựng — đừng sửa tay)
scripts/add_news.py             kiểm tra tin, khử trùng URL giữa các ngày, kiểm link, dựng data/news/index.json
scripts/add_day.py              kiểm tra + tính điểm/hạng + dựng index
DAILY_UPDATE.md                 quy trình cập nhật hằng ngày (đọc kỹ)
```

## Chạy thử local
```
python3 -m http.server 8000     # rồi mở http://localhost:8000/
python3 scripts/add_day.py --all --check-links
```

## Chấm điểm
6 tiêu chí 1–10, **tổng = Σ điểm × trọng số** (thang 10): dễ làm 0,18 · nhu cầu 0,22 · mới lạ 0,12 · vốn thấp 0,16 · tín hiệu quốc tế 0,14 · **hợp hành vi giới trẻ VN 0,18**. Hạng: tổng giảm dần → tín hiệu → nhu cầu → id. Điểm `vnfit` ≥ 8 chỉ khi dẫn ≥ 2 dữ kiện đã xác minh ở `vn-youth.json`. Chi tiết ở tab *Phương pháp* và `DAILY_UPDATE.md`.

## Lưu ý
Nội dung chỉ để tham khảo, **không phải tư vấn đầu tư/pháp lý**. Dữ liệu nước ngoài có dẫn nguồn; từ khóa hot là ảnh chụp tại một thời điểm (các bảng tìm kiếm nghiêng về thể thao/tin nóng); phần áp dụng cho Việt Nam thường là **giả thuyết** cần test. Tỷ giá USD/VND chỉ là ước lượng (xem `data/config.json`).
