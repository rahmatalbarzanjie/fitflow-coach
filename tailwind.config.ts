import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
      },
      colors: {
        'accent-poundfit': '#F87171',
        'accent-barre':    '#FDA4AF',
        'accent-zumba':    '#2DD4BF',
        'surface-container':        '#efecff',
        'surface-container-lowest': '#ffffff',
        'surface-variant':          '#e2e0fc',
        'on-surface':               '#1a1a2e',
        'on-surface-variant':       '#464555',
        'outline-variant':          '#c7c4d8',
        'outline-muted':            '#777587',
      },
      maxWidth: {
        'container-max': '1280px',
      },
    },
  },
  plugins: [],
}

export default config
