/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f9f6ed',  // Dorado muy suave para fondos
          100: '#f1ead3', // Dorado claro
          500: '#c5a03f', // DORADO PRINCIPAL (Color del logo)
          600: '#a98832', // Dorado más oscuro para efectos hover
          900: '#700016', // Bordó intenso para acentos oscuros
        },
        dark: {
          DEFAULT: '#121212', // Negro para textos principales y fondos oscuros
          'muted': '#27272a',  // Gris oscuro para elementos secundarios
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], // Fuente moderna y limpia
      },
      boxShadow: {
        'nav': '0 -1px 3px 0 rgba(0, 0, 0, 0.05), 0 -1px 2px -1px rgba(0, 0, 0, 0.02)', // Sombra sutil para la barra inferior
      }
    },
  },
  plugins: [],
}