/**
 * Vietnamese (vi) dictionary — the primary locale for the Desygn A11y
 * marketing landing page.
 */

import type { Dictionary } from "./types.js";

export const vi: Dictionary = {
  // ─── Brand / nav ─────────────────────────────────────────────────
  "brand.name": "Desygn A11y",
  "nav.features": "Tính năng",
  "nav.pricing": "Bảng giá",
  "nav.faq": "Hỏi đáp",
  "skip.toContent": "Bỏ qua tới nội dung chính",

  // ─── Language toggle ─────────────────────────────────────────────
  "lang.toggleLabel": "Ngôn ngữ",
  "lang.vi": "Tiếng Việt",
  "lang.en": "Tiếng Anh",

  // ─── Hero ────────────────────────────────────────────────────────
  "hero.eyebrow": "Khả năng truy cập dưới dạng dịch vụ",
  "hero.title": "Phát hiện vi phạm WCAG rẻ hơn 10 lần, ngay trong Figma.",
  "hero.subtitle":
    "Nền tảng truy cập duy nhất kiểm tra thiết kế của bạn trước khi viết một dòng mã. Bắt lỗi sớm, sửa nhanh, tránh kiện tụng tốn kém.",
  "hero.ctaPrimary": "Dùng thử miễn phí",
  "hero.ctaSecondary": "Xem báo cáo mẫu",
  "hero.trust":
    "Đối chiếu WCAG 2.2 AA · Báo cáo PDF có chữ ký pháp lý · Không cần thẻ tín dụng",

  // ─── Features section ────────────────────────────────────────────
  "features.heading": "Vì sao chọn Desygn A11y",
  "features.subheading":
    "Bốn lý do khiến đội thiết kế và kỹ thuật bắt lỗi truy cập sớm hơn và rẻ hơn.",
  "features.designFirst.title": "Ưu tiên thiết kế",
  "features.designFirst.body":
    "Kiểm tra ngay trong Figma trước khi code. Sửa một vi phạm ở khâu thiết kế rẻ hơn gấp 10 lần so với sau khi phát hành.",
  "features.aiNative.title": "Gốc AI (MCP)",
  "features.aiNative.body":
    "Máy chủ MCP tích hợp sẵn để tác nhân lập trình AI tự động đọc kết quả audit và đề xuất bản sửa ngay trong quy trình của bạn.",
  "features.legalGrade.title": "Báo cáo cấp pháp lý",
  "features.legalGrade.body":
    "Xuất báo cáo PDF có chữ ký số làm bằng chứng tuân thủ — sẵn sàng cho kiểm toán, hợp đồng và yêu cầu pháp lý.",
  "features.multiSurface.title": "Đa nền tảng",
  "features.multiSurface.body":
    "Một công cụ audit, mọi nơi: Plugin Figma, Dashboard web, GitHub Action và tích hợp IDE — cùng một bộ quy tắc.",

  // ─── Pricing section ─────────────────────────────────────────────
  "pricing.heading": "Giá đơn giản, minh bạch",
  "pricing.subheading":
    "Bắt đầu miễn phí. Nâng cấp khi đội của bạn phát triển. Hủy bất cứ lúc nào.",
  "pricing.perMonth": "/tháng",
  "pricing.popular": "Phổ biến nhất",
  "pricing.free.name": "Miễn phí",
  "pricing.free.price": "0₫",
  "pricing.free.desc": "5 lần audit mỗi tháng. Hoàn hảo để dùng thử.",
  "pricing.free.cta": "Bắt đầu miễn phí",
  "pricing.pro.name": "Pro",
  "pricing.pro.price": "29$",
  "pricing.pro.desc": "100 lần audit mỗi tháng cho nhà thiết kế cá nhân.",
  "pricing.pro.cta": "Chọn gói Pro",
  "pricing.team.name": "Team",
  "pricing.team.price": "299$",
  "pricing.team.desc": "1.000 lần audit mỗi tháng, 5 chỗ ngồi cho cả đội.",
  "pricing.team.cta": "Chọn gói Team",
  "pricing.enterprise.name": "Enterprise",
  "pricing.enterprise.price": "Liên hệ",
  "pricing.enterprise.desc":
    "Hạn mức tùy chỉnh, SSO, SLA và hỗ trợ tận tâm.",
  "pricing.enterprise.cta": "Liên hệ kinh doanh",

  // ─── FAQ section ─────────────────────────────────────────────────
  "faq.heading": "Câu hỏi thường gặp",
  "faq.subheading": "Mọi điều bạn cần biết trước khi bắt đầu.",
  "faq.q1": "Desygn A11y hoạt động như thế nào?",
  "faq.a1":
    "Kết nối tệp Figma của bạn, chúng tôi đối chiếu thiết kế với WCAG 2.2 AA và trả về danh sách vi phạm kèm hướng dẫn sửa — tất cả trước khi bạn viết mã.",
  "faq.q2": "Tôi có cần biết về WCAG không?",
  "faq.a2":
    "Không. Mỗi phát hiện đều đi kèm giải thích rõ ràng, mức độ nghiêm trọng và cách khắc phục cụ thể, nên cả đội đều hiểu được.",
  "faq.q3": "Báo cáo PDF có giá trị pháp lý không?",
  "faq.a3":
    "Báo cáo của chúng tôi có chữ ký số và dấu thời gian, dùng làm bằng chứng tuân thủ cho kiểm toán và hợp đồng. Hãy tham khảo cố vấn pháp lý cho trường hợp cụ thể của bạn.",
  "faq.q4": "Tôi có thể dùng trong CI/CD không?",
  "faq.a4":
    "Có. GitHub Action và tích hợp IDE cho phép chạy cùng bộ quy tắc audit tự động trong pipeline của bạn.",

  // ─── Footer ──────────────────────────────────────────────────────
  "footer.tagline": "Phát hiện vi phạm WCAG rẻ hơn 10 lần, ngay trong Figma.",
  "footer.product": "Sản phẩm",
  "footer.linkFeatures": "Tính năng",
  "footer.linkPricing": "Bảng giá",
  "footer.linkFaq": "Hỏi đáp",
  "footer.resources": "Tài nguyên",
  "footer.linkDocs": "Tài liệu",
  "footer.linkDashboard": "Dashboard",
  "footer.linkGithub": "GitHub",
  "footer.rights": "Đã đăng ký bản quyền.",
};
