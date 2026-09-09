import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    // Phaser UI components
    "./phaser/**/*.{ts,tsx}",
    // Keep src/* covered until Phase 2 moves it.
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    fontFamily: {
      body: ['var(--font-press-start)', '"Press Start 2p"', 'sans-serif'],
      pixel: ['var(--font-press-start)', '"Press Start 2p"', 'sans-serif'],
      sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      serif: ['var(--font-serif)', 'Georgia', 'serif'],
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        // Game-specific colors (preserved for game pages)
        green: {
          background: "#63c74d",
        },
        blue: {
          600: "#0d87ff",
        },
        brown: {
          100: "#EAD4AA",
          200: "#e7a873",
          300: "#c28669",
          400: "#966953",
          600: "#b96f50",
          700: "#945542",
        },
        silver: {
          300: "#bfcbda",
        },
        // Lucky Frog rarity / stat colors — used in FrogDetailModal and DropResultModal.
        // Defined as literal hex values (not CSS var tokens) so they work without
        // the extra :root token declarations that have been removed.
        neon: "#3db85a",
        gold: "#d4a017",
        lily: "#5ecb6e",
        rose: "#e05252",
      },
      fontSize: {
        xxs: "0.6rem",
      },
      // The height/width of the gameboard background image.
      height: {
        gameboard: "2100px",
      },
      width: {
        gameboard: "2100px",
      },
      animation: {
        float: "floating 3s ease-in-out infinite",
        pulsate: "pulsate 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
