/**
 * English locale (base) — Desygn AI
 *
 * Source of truth: every key here must exist in other locales.
 * Use lowercase dot.notation for nested keys.
 */

import type { LocaleDictionary } from "../types";

const en: LocaleDictionary = {
  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    confirm: "Confirm",
    yes: "Yes",
    no: "No",
  },

  nav: {
    chat: "Chat",
    checklist: "Checklist",
    builder: "Builder",
    settings: "Settings",
  },

  checklist: {
    title: "UI/UX Checklist",
    header: "Checklist UI/UX",
    exportReport: "Export Report",
    setupSource: "Set up Data Source",

    filter: {
      all: "All",
      ui: "UI",
      ux: "UX",
      pass: "Pass",
      fail: "Fail",
      warn: "Warn",
    },

    category: {
      visualDesign: "Visual Design",
      typography: "Typography",
      accessibility: "Accessibility",
      interaction: "Interaction",
    },

    table: {
      stt: "#",
      criterion: "Criterion",
      status: "Status",
      score: "Score",
      detail: "Detail",
    },

    status: {
      pass: "Pass",
      fail: "Fail",
      warn: "Warn",
      skip: "Skip",
    },

    report: {
      title: "UI/UX Review Report",
      totalScore: "Total Score",
      notTested: "Not tested",
      exportCsv: "Export CSV",
      exportPdf: "Export PDF",
      exportMd: "Export Markdown",
    },

    search: {
      placeholder: "Search criteria...",
      empty: "No criteria match your search.",
    },

    setup: {
      title: "Connection Setup",
      tabs: {
        dataSource: "Data Source",
        criteria: "Checklist Criteria",
        mcp: "MCP/Tools Connection",
      },
    },
  },

  toast: {
    saved: "Saved",
    deleted: "Deleted",
    copied: "Copied to clipboard",
    failed: "Operation failed",
  },
};

export default en;
