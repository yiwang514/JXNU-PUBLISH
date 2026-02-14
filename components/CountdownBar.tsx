import React from 'react';
import { formatTimestamp, getCountdownText } from '@/lib/time-window';

interface CountdownBarProps {
  progress: number;
  endAt?: string;
  nowTs: number;
  size: 'sm' | 'md';
}

/* ---- Global CSS for Stripe Animation ---- */
const STRIPE_CSS = `
@keyframes cdb-scroll {
  from { background-position: 0 0; }
  to { background-position: 32px 0; }
}
.cdb-stripe-animate {
  animation: cdb-scroll 2s linear infinite !important;
  background-size: 32px 32px !important;
  will-change: width, background-position;
}
`;

let cssInjected = false;
function ensureCSS() {
  if (typeof document === 'undefined' || cssInjected) return;
  const tag = document.createElement('style');
  tag.textContent = STRIPE_CSS;
  document.head.appendChild(tag);
  cssInjected = true;
}

export const CountdownBar: React.FC<CountdownBarProps> = React.memo(({ progress, endAt, nowTs, size }) => {
  const barRef = React.useRef<HTMLDivElement>(null);
  const countdownLabel = `剩余 ${getCountdownText(endAt, nowTs)}`;
  const whiteMix = Math.max(0, Math.min(1, (progress - 45) / 15));

  const barHeight = size === 'sm' ? 'h-5' : 'h-6';
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const headerTextSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';
  const stripeOpacity = size === 'sm' ? 0.78 : 0.75;

  const gradient = React.useMemo(
    () => `linear-gradient(45deg, 
      hsl(var(--primary)) 25%, 
      hsl(var(--primary) / ${stripeOpacity}) 25%, 
      hsl(var(--primary) / ${stripeOpacity}) 50%, 
      hsl(var(--primary)) 50%, 
      hsl(var(--primary)) 75%, 
      hsl(var(--primary) / ${stripeOpacity}) 75%, 
      hsl(var(--primary) / ${stripeOpacity}) 100%)`,
    [stripeOpacity]
  );

  React.useEffect(ensureCSS, []);

  /**
   * Use WAAPI to drive the progress bar width.
   * This is more robust on mobile than CSS transitions because it runs
   * on the compositor thread and we explicitly prevent React from
   * overwriting the 'width' property during subsequent renders.
   */
  React.useEffect(() => {
    const el = barRef.current;
    if (!el || !endAt) return;

    const endMs = new Date(endAt).getTime();
    const remainMs = endMs - Date.now();

    if (remainMs <= 0) {
      el.style.width = '100%';
      return;
    }

    // Set initial width
    el.style.width = `${progress}%`;

    // Start long-running animation to 100%
    const anim = el.animate(
      [
        { width: `${progress}%` },
        { width: '100%' }
      ],
      {
        duration: remainMs,
        easing: 'linear',
        fill: 'forwards'
      }
    );

    return () => anim.cancel();
    // We only re-run this if endAt changes. 
    // This prevents React re-renders from interrupting the smooth animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);

  return (
    <div className="w-full space-y-1.5">
      <div className={`flex items-center justify-between ${headerTextSize}`}>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary text-primary-foreground font-bold">限时</span>
        <span className="text-muted-foreground">截止 {formatTimestamp(endAt)}</span>
      </div>
      <div className={`relative w-full ${barHeight} rounded-full bg-muted overflow-hidden border border-border/40`}>
        {/* 
          The progress bar div. 
          Note: 'width' is NOT in the style prop to prevent React from 
          touching it after the initial mount, allowing WAAPI to control it smoothly.
        */}
        <div
          ref={barRef}
          className="absolute inset-y-0 left-0 cdb-stripe-animate"
          style={{
            backgroundImage: gradient,
          }}
        />
        
        {/* Text overlay */}
        <div className={`absolute inset-0 flex items-center justify-center ${textSize} font-semibold pointer-events-none`}>
          <span className="relative leading-none">
            <span className="text-foreground">{countdownLabel}</span>
            <span
              className="absolute inset-0 text-primary-foreground transition-opacity duration-300"
              style={{ opacity: whiteMix }}
              aria-hidden="true"
            >
              {countdownLabel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});
