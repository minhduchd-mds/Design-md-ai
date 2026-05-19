/**
 * Vietnamese locale — Desygn AI
 */

import type { LocaleDictionary } from "../types";

const vi: LocaleDictionary = {
  common: {
    save: "Lưu",
    cancel: "Hủy",
    close: "Đóng",
    delete: "Xóa",
    edit: "Sửa",
    loading: "Đang tải...",
    error: "Lỗi",
    retry: "Thử lại",
    confirm: "Xác nhận",
    yes: "Có",
    no: "Không",
  },

  nav: {
    chat: "Trò chuyện",
    checklist: "Danh sách kiểm tra",
    builder: "Tạo dựng",
    settings: "Cài đặt",
  },

  checklist: {
    title: "Checklist UI/UX",
    header: "Checklist UI/UX",
    exportReport: "Xuất báo cáo",
    setupSource: "Cài đặt nguồn dữ liệu",

    filter: {
      all: "Tất cả",
      ui: "UI",
      ux: "UX",
      pass: "Đạt",
      fail: "Không đạt",
      warn: "Cảnh báo",
    },

    category: {
      visualDesign: "Visual Design",
      typography: "Typography",
      accessibility: "Accessibility",
      interaction: "Interaction",
    },

    table: {
      stt: "STT",
      criterion: "Tiêu chí",
      status: "Trạng thái",
      score: "Điểm",
      detail: "Chi tiết",
    },

    status: {
      pass: "Đạt",
      fail: "Không đạt",
      warn: "Cảnh báo",
      skip: "Bỏ qua",
    },

    report: {
      title: "Báo cáo UI/UX Review",
      totalScore: "Điểm tổng",
      notTested: "Chưa test",
      exportCsv: "Xuất CSV",
      exportPdf: "Xuất PDF",
      exportMd: "Xuất Markdown",
    },

    search: {
      placeholder: "Tìm tiêu chí...",
      empty: "Không có tiêu chí nào khớp với tìm kiếm.",
    },

    setup: {
      title: "Cài đặt kết nối",
      tabs: {
        dataSource: "Nguồn dữ liệu",
        criteria: "Tiêu chí Checklist",
        mcp: "Kết nối MCP/Tools",
      },
    },
  },

  toast: {
    saved: "Đã lưu",
    deleted: "Đã xóa",
    copied: "Đã sao chép",
    failed: "Thao tác thất bại",
  },
};

export default vi;
