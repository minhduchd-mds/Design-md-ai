/// <reference types="vite/client" />

/**
 * Typed Vite env vars for the dashboard. Augments `import.meta.env` (the base
 * `ImportMetaEnv` shape comes from `vite/client`, referenced above, which also
 * declares `*.module.css` so CSS Module imports are typed).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
