/** Graduation cap / skill icon — used for skill import actions. */
export function SkillIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M14.6667 5.99999L8 3.33333L1.33334 5.99999L8 8.66666L14.6667 5.99999ZM14.6667 5.99999V9.99999M4 7.06667V10.6667C4 11.1971 4.42143 11.7058 5.17158 12.0809C5.92172 12.456 6.93914 12.6667 8 12.6667C9.06087 12.6667 10.0783 12.456 10.8284 12.0809C11.5786 11.7058 12 11.1971 12 10.6667V7.06667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
