import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },

      /* -----------------------------------------------------------------
         NEON-NOIR COLOR PALETTE
         Usage: bg-panel, text-neon-pink, border-neon-cyan, etc.
         ----------------------------------------------------------------- */
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Background layers
        darkest: "var(--color-bg-darkest)",
        deep: "var(--color-bg-deep)",
        panel: "var(--color-bg-panel)",
        card: "var(--color-bg-card)",
        "card-hover": "var(--color-bg-card-hover)",
        elevated: "var(--color-bg-elevated)",

        // Neon accents (usable as bg-neon-pink, text-neon-cyan, etc.)
        neon: {
          pink: "var(--color-neon-pink)",
          cyan: "var(--color-neon-cyan)",
          gold: "var(--color-neon-gold)",
          green: "var(--color-neon-green)",
          red: "var(--color-neon-red)",
          orange: "var(--color-neon-orange)",
          purple: "var(--color-neon-purple)",
        },

        // Glass / overlay
        glass: "var(--color-glass)",
        overlay: "var(--color-overlay)",
      },

      /* -----------------------------------------------------------------
         BORDER COLORS (use: border-game-DEFAULT, border-game-subtle)
         ----------------------------------------------------------------- */
      borderColor: {
        game: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
      },

      /* -----------------------------------------------------------------
         SPACING (supplemental -- Tailwind's built-in scale covers most)
         ----------------------------------------------------------------- */
      spacing: {
        'topbar': 'var(--topbar-height)',
        'toolbar': 'var(--toolbar-height)',
        'info-panel': 'var(--info-panel-width)',
      },

      /* -----------------------------------------------------------------
         Z-INDEX SCALE
         ----------------------------------------------------------------- */
      zIndex: {
        'canvas': '0',
        'ui': '10',
        'panel': '20',
        'topbar': '30',
        'toolbar': '30',
        'picker': '35',
        'modal-backdrop': '50',
        'modal': '51',
        'notification': '100',
      },

      /* -----------------------------------------------------------------
         BORDER RADIUS
         ----------------------------------------------------------------- */
      borderRadius: {
        'game-sm': 'var(--radius-sm)',
        'game-md': 'var(--radius-md)',
        'game-lg': 'var(--radius-lg)',
        'game-xl': 'var(--radius-xl)',
      },

      /* -----------------------------------------------------------------
         BOX SHADOW (neon glows)
         ----------------------------------------------------------------- */
      boxShadow: {
        'panel': 'var(--shadow-panel)',
        'modal': 'var(--shadow-modal)',
        'glow-pink': 'var(--shadow-glow-pink)',
        'glow-cyan': 'var(--shadow-glow-cyan)',
        'glow-gold': 'var(--shadow-glow-gold)',
      },

      /* -----------------------------------------------------------------
         BACKDROP BLUR
         ----------------------------------------------------------------- */
      backdropBlur: {
        'xs': '2px',
        'panel': '12px',
        'heavy': '24px',
      },

      /* -----------------------------------------------------------------
         ANIMATION KEYFRAMES
         ----------------------------------------------------------------- */
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-scale': {
          from: { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 4px rgba(8, 217, 214, 0.2), 0 0 8px rgba(8, 217, 214, 0.1)',
          },
          '50%': {
            boxShadow: '0 0 8px rgba(8, 217, 214, 0.4), 0 0 16px rgba(8, 217, 214, 0.2), 0 0 24px rgba(8, 217, 214, 0.1)',
          },
        },
        'neon-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(255, 46, 99, 0.3), 0 0 10px rgba(255, 46, 99, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 10px rgba(255, 46, 99, 0.5), 0 0 20px rgba(255, 46, 99, 0.3), 0 0 30px rgba(255, 46, 99, 0.1)',
          },
        },
        'notification-enter': {
          from: { transform: 'translateX(120%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'notification-exit': {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(120%)', opacity: '0' },
        },
      },

      /* -----------------------------------------------------------------
         ANIMATION UTILITIES
         Usage: animate-slideInRight, animate-fadeIn, animate-pulseGlow
         ----------------------------------------------------------------- */
      animation: {
        'slideInRight': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slideInUp': 'slide-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fadeIn': 'fade-in 0.3s ease forwards',
        'fadeInScale': 'fade-in-scale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulseGlow': 'pulse-glow 2s ease-in-out infinite',
        'neonPulse': 'neon-pulse 2s ease-in-out infinite',
        'notificationEnter': 'notification-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'notificationExit': 'notification-exit 0.2s ease-in forwards',
      },

      /* -----------------------------------------------------------------
         TRANSITION DURATION (game-specific tokens)
         ----------------------------------------------------------------- */
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
        'panel': '300ms',
      },

      /* -----------------------------------------------------------------
         TRANSITION TIMING FUNCTION
         ----------------------------------------------------------------- */
      transitionTimingFunction: {
        'panel': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
export default config;
