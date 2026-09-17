import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Dark mode is driven purely by CSS custom properties + prefers-color-scheme media query.
  // No Tailwind 'dark:' class needed — CSS vars swap automatically.
  theme: {
    extend: {
      // ── UI Surface tokens ────────────────────────────────────────────────────
      // ALL colour values reference CSS custom properties defined in globals.css.
      // Never use raw OKLCH / hex / hsl values in components — always use these tokens.
      colors: {
        paper: {
          DEFAULT: 'var(--color-paper)',      // document & workspace background
          2:       'var(--color-paper-2)',     // panel / sidebar background
          3:       'var(--color-paper-3)',     // hover tint / subtle fill
          border:  'var(--color-border)',      // hairline rules
        },
        ink: {
          DEFAULT: 'var(--color-ink)',         // primary body text
          2:       'var(--color-ink-2)',       // secondary / label text
          3:       'var(--color-ink-3)',       // placeholder / muted text
        },
        accent: {
          DEFAULT: 'var(--color-accent)',      // primary action (terra-cotta)
          hover:   'var(--color-accent-hover)',
          subtle:  'var(--color-accent-subtle)', // bg for active/selected states
          text:    'var(--color-accent-text)',    // readable text on accent-subtle
        },
        chrome: {
          bg:     'var(--color-chrome-bg)',      // topbar / statusbar background
          border: 'var(--color-chrome-border)',  // topbar underline, statusbar top
        },
        // Semantic state colours — used ONLY for status indicators, never UI chrome.
        // These are intentionally vivid (not derived from the warm paper palette).
        state: {
          connected:    'var(--color-state-connected)',
          connecting:   'var(--color-state-connecting)',
          offline:      'var(--color-state-offline)',
          reconnecting: 'var(--color-state-reconnecting)',
        },
      },

      // ── Typography tokens ─────────────────────────────────────────────────────
      fontFamily: {
        // Document body — Lora (transitional serif), loaded via next/font
        serif:  ['var(--font-serif)',  'Georgia', 'Cambria', 'serif'],
        // UI chrome — Inter (compact sans), loaded via next/font
        ui:     ['var(--font-ui)',     'system-ui', 'sans-serif'],
        // Code & metadata — JetBrains Mono, loaded via next/font
        mono:   ['var(--font-mono)',   'ui-monospace', 'Menlo', 'monospace'],
      },

      fontSize: {
        // UI chrome sizes — used in buttons, labels, sidebar text
        '2xs':  ['0.6875rem', { lineHeight: '1rem' }],       // 11px — metadata chips
        'xs':   ['0.75rem',   { lineHeight: '1.125rem' }],   // 12px — secondary labels
        'sm':   ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px — button text
        'base': ['0.9375rem', { lineHeight: '1.5rem' }],     // 15px — UI body
        // Document body type scale is set in ProseMirror CSS in globals.css
      },

      // ── Spacing additions ─────────────────────────────────────────────────────
      spacing: {
        '4.5':  '1.125rem',
        '18':   '4.5rem',
        '22':   '5.5rem',
        '72':   '18rem',
        '80':   '20rem',
        '88':   '22rem',
        '96':   '24rem',
        '112':  '28rem',
        '128':  '32rem',
      },

      // ── Max-widths ─────────────────────────────────────────────────────────────
      maxWidth: {
        'prose-lg': '72ch',    // editor page column (68ch content + 4ch padding)
        'panel':    '22rem',   // right-hand slide-over panels
        'topbar':   '90rem',   // topbar content max-width
      },

      // ── Transitions ────────────────────────────────────────────────────────────
      // Per the brief: 150–200ms on state changes only. No decorative animation.
      transitionDuration: {
        DEFAULT: '150ms',
        'fast':   '100ms',
        'normal': '175ms',
        'slow':   '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ── Focus ring ─────────────────────────────────────────────────────────────
      ringColor: {
        DEFAULT: 'var(--color-focus)',
        focus:   'var(--color-focus)',
      },
      ringOffsetColor: {
        DEFAULT: 'var(--color-paper)',
      },

      // ── Shadows ────────────────────────────────────────────────────────────────
      boxShadow: {
        // Document page lift — barely perceptible, editorial
        'page':    '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px 0 rgb(0 0 0 / 0.04)',
        // Floating selection toolbar
        'toolbar': '0 2px 8px 0 rgb(0 0 0 / 0.12), 0 0 0 1px var(--color-border)',
        // Right-hand slide-over panel
        'panel':   '-4px 0 20px 0 rgb(0 0 0 / 0.08)',
        // Small interactive element hover
        'lift':    '0 1px 3px 0 rgb(0 0 0 / 0.08)',
      },

      // ── Border radius ──────────────────────────────────────────────────────────
      borderRadius: {
        'sm':  '3px',
        'DEFAULT': '4px',
        'md':  '6px',
        'lg':  '8px',
        'xl':  '12px',
        'full': '9999px',
      },

      // ── Animation ──────────────────────────────────────────────────────────────
      // Minimal — only what is functionally necessary (skeleton pulse, spinner)
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'slide-in-top': {
          from: { transform: 'translateY(-4px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.8s ease-in-out infinite',
        'fade-in':        'fade-in 150ms ease-out',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-top':   'slide-in-top 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

export default config
