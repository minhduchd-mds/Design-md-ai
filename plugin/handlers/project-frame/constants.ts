/**
 * project-frame/constants — Shared constants, colors, and types.
 */

export const FRAME_WIDTH = 1440;
export const FRAME_PADDING = 48;
export const CARD_WIDTH = 260;
export const CARD_HEIGHT = 160;
export const CONTENT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;

export const COLORS = {
  bg:       { r: 0.965, g: 0.973, b: 0.984 },
  white:    { r: 1, g: 1, b: 1 },
  card:     { r: 0.992, g: 0.996, b: 1 },
  border:   { r: 0.86, g: 0.89, b: 0.93 },
  borderL:  { r: 0.91, g: 0.93, b: 0.96 },
  title:    { r: 0.07, g: 0.09, b: 0.13 },
  heading:  { r: 0.09, g: 0.11, b: 0.15 },
  body:     { r: 0.33, g: 0.37, b: 0.44 },
  meta:     { r: 0.5, g: 0.54, b: 0.6 },
  tag:      { r: 0.18, g: 0.22, b: 0.28 },
  tagBg:    { r: 0.94, g: 0.96, b: 0.98 },
  tagStroke:{ r: 0.84, g: 0.87, b: 0.91 },
  accent:   { r: 0.22, g: 0.47, b: 0.97 },
  accentBg: { r: 0.93, g: 0.95, b: 1 },
  empty:    { r: 0.62, g: 0.66, b: 0.72 },
  emptyBg:  { r: 0.96, g: 0.97, b: 0.98 },
  instance: { r: 0.12, g: 0.72, b: 0.56 },
  placeholder:{ r: 0.96, g: 0.68, b: 0.2 },
};

export interface FrameBuildState {
  instanceCount: number;
  placeholderCount: number;
}
