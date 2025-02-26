/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                walrus: {
                    dark: '#0d1117',      // Dark background
                    darker: '#080b10',    // Even darker elements
                    teal: '#7CFBFF',      // Teal accent for buttons and highlights
                    purple: '#8F7CF1',    // Purple accent (from the .SITE part)
                    text: '#ffffff',      // Primary text
                    secondary: '#adb5bd',  // Secondary text/accents
                    border: '#1E2A3B',    // Subtle borders
                }
            },
            fontFamily: {
                pixel: ['VT323', 'monospace'],
            }
        },
    },
    plugins: [],
}; 