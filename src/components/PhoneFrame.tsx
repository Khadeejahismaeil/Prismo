"use client";

/**
 * A premium phone shell. On large screens it renders an iPhone-style device
 * with a dynamic island + status bar; on small screens it goes full-bleed.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-0 sm:p-6">
      <div
        className="relative h-[100dvh] w-full overflow-hidden bg-transparent sm:h-[860px] sm:max-h-[92vh] sm:w-[400px] sm:rounded-[3rem] sm:border-[10px] sm:border-[#241318] sm:shadow-[0_50px_120px_-30px_rgba(54,32,44,0.65)]"
      >
        {/* status bar */}
        <div className="relative z-20 flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-[var(--ink)]">
          <span>9:41</span>
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2.5 h-7 w-24 -translate-x-1/2 rounded-full bg-[#241318]" />
          <span className="flex items-center gap-1.5">
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
              <rect x="0" y="7" width="3" height="5" rx="1" fill="currentColor" />
              <rect x="5" y="4" width="3" height="8" rx="1" fill="currentColor" />
              <rect x="10" y="1.5" width="3" height="10.5" rx="1" fill="currentColor" />
              <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" opacity="0.35" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M8 2.5c2 0 3.8.8 5.2 2.1l1.4-1.5A9.3 9.3 0 0 0 8 .6 9.3 9.3 0 0 0 1.4 3.1l1.4 1.5A7.3 7.3 0 0 1 8 2.5Z" fill="currentColor" />
              <path d="M8 6c1 0 1.9.4 2.6 1.1l1.4-1.5A6 6 0 0 0 8 4a6 6 0 0 0-4 1.6l1.4 1.5A4 4 0 0 1 8 6Z" fill="currentColor" />
              <circle cx="8" cy="9.6" r="1.8" fill="currentColor" />
            </svg>
            <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
              <rect x="0.5" y="0.5" width="21" height="12" rx="3.5" stroke="currentColor" opacity="0.5" />
              <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
              <rect x="23" y="4" width="2" height="5" rx="1" fill="currentColor" opacity="0.5" />
            </svg>
          </span>
        </div>

        {/* app content */}
        <div className="no-scrollbar relative h-[calc(100%-2.25rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
