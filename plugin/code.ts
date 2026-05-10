import type { PluginMessage } from "../shared/types";
import { sendSelection, handleSelectionMessage } from "./handlers/selection";
import { sendProfilesOnStartup, handleProfileMessage } from "./handlers/profiles";
import { handleFigmaImportMessage } from "./handlers/figma-import";
import { handleFixMessage } from "./handlers/fixes";
import { handleAutoLayoutMessage } from "./handlers/autolayout";
import { handleProjectFrameMessage } from "./handlers/project-frame";

// ── Plugin init ──

figma.showUI(__html__, { width: 480, height: 768, themeColors: true });

// Send profiles to UI on startup
sendProfilesOnStartup();

// Track selection changes
figma.on("selectionchange", sendSelection);

// ── Message router ──

figma.ui.onmessage = async (msg: PluginMessage) => {
  // Try each handler domain — first match wins
  if (await handleSelectionMessage(msg)) return;
  if (await handleProfileMessage(msg)) return;
  if (await handleFigmaImportMessage(msg)) return;
  if (await handleFixMessage(msg)) return;
  if (await handleAutoLayoutMessage(msg)) return;
  if (await handleProjectFrameMessage(msg)) return;
};
