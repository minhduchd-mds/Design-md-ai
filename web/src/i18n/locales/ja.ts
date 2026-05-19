/**
 * Japanese locale — Desygn AI
 */

import type { LocaleDictionary } from "../types";

const ja: LocaleDictionary = {
  common: {
    save: "保存",
    cancel: "キャンセル",
    close: "閉じる",
    delete: "削除",
    edit: "編集",
    loading: "読み込み中...",
    error: "エラー",
    retry: "再試行",
    confirm: "確認",
    yes: "はい",
    no: "いいえ",
  },

  nav: {
    chat: "チャット",
    checklist: "チェックリスト",
    builder: "ビルダー",
    settings: "設定",
  },

  checklist: {
    title: "UI/UX チェックリスト",
    header: "UI/UX チェックリスト",
    exportReport: "レポート出力",
    setupSource: "データソース設定",

    filter: {
      all: "すべて",
      ui: "UI",
      ux: "UX",
      pass: "合格",
      fail: "不合格",
      warn: "警告",
    },

    category: {
      visualDesign: "ビジュアルデザイン",
      typography: "タイポグラフィ",
      accessibility: "アクセシビリティ",
      interaction: "インタラクション",
    },

    table: {
      stt: "No.",
      criterion: "基準",
      status: "ステータス",
      score: "スコア",
      detail: "詳細",
    },

    status: {
      pass: "合格",
      fail: "不合格",
      warn: "警告",
      skip: "スキップ",
    },

    report: {
      title: "UI/UX レビューレポート",
      totalScore: "総合スコア",
      notTested: "未テスト",
      exportCsv: "CSV 出力",
      exportPdf: "PDF 出力",
      exportMd: "Markdown 出力",
    },

    search: {
      placeholder: "基準を検索...",
      empty: "検索条件に一致する基準がありません。",
    },

    setup: {
      title: "接続設定",
      tabs: {
        dataSource: "データソース",
        criteria: "チェックリスト基準",
        mcp: "MCP/ツール接続",
      },
    },
  },

  toast: {
    saved: "保存しました",
    deleted: "削除しました",
    copied: "クリップボードにコピーしました",
    failed: "操作に失敗しました",
  },
};

export default ja;
