# Chính sách bảo mật (Security Policy)

## Phiên bản được hỗ trợ

| Phiên bản | Hỗ trợ             |
| --------- | ------------------- |
| 5.0.x     | :white_check_mark:  |
| 2.0.x     | :white_check_mark:  |
| 1.1.x     | :x: (ngừng hỗ trợ) |
| < 1.1     | :x:                 |

## Tính năng bảo mật

### Core (v2.0+)
- **PII Detection** — Quét tự động credit cards (Luhn), SSN, Vietnamese CCCD/CMND/phone, email, auth tokens
- **Content Redaction** — Block hoặc redact PII trước khi xử lý AI hoặc sync collaboration
- **Input Sanitization** — DOMPurify cho tất cả nội dung user-facing, phòng chống prompt injection
- **Security Headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy qua `vercel.json`
- **No Secrets in Code** — Tất cả API keys qua environment variables

### Agent System (v5.0+)
- **Agent Isolation** — Mỗi agent chạy trong scope riêng, không truy cập trực tiếp Figma API từ scoring modules
- **Criteria Validation** — CriteriaRegistry kiểm tra confidence bounds (0-1), ngăn chặn invalid weights
- **Evidence Integrity** — Sigmoid decay đảm bảo evidence cũ mất trọng số, garbage collection tự động
- **GDPR Forget** — CrossProjectLearning hỗ trợ xóa toàn bộ dữ liệu học từ một project
- **CI Gate Security** — Score thresholds ngăn deploy code chất lượng thấp, SARIF reports cho GitHub Code Scanning
- **GitHub Bridge Auth** — Token-based authentication, không lưu credentials trong code
- **Memory Persistence** — localStorage với key prefix isolation, không cross-domain data leaks
- **Prompt Sanitization** — Tất cả agent output đi qua `sanitize.ts` trước khi render

## Báo cáo lỗ hổng bảo mật

Nếu phát hiện lỗ hổng bảo mật, vui lòng báo cáo có trách nhiệm:

1. **KHÔNG** tạo GitHub issue công khai
2. Email: security@desygn.ai (hoặc tạo private security advisory trên GitHub)
3. Bao gồm: mô tả lỗ hổng, các bước tái tạo, mức độ ảnh hưởng
4. Chúng tôi sẽ phản hồi trong 48 giờ và cung cấp timeline sửa lỗi

## Dependencies

Tất cả dependencies được duy trì ở phiên bản minor mới nhất. `npm audit` chạy trên mỗi CI build. Trạng thái hiện tại: **0 lỗ hổng đã biết**.
