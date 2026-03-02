/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0068FF",
          dark: "#0054CC",
          light: "#4D94FF",
          bg: "#E6F0FF",
        },
        secondary: {
          DEFAULT: "#00C853",
          dark: "#009624",
        },
        surface: "#FFFFFF",
        background: "#F5F5F5",
        bubble: {
          sent: "#D5E8FF",
          received: "#F0F0F0",
        },
        online: "#4CAF50",
        offline: "#9E9E9E",
        busy: "#F44336",
        divider: "#EEEEEE",
        badge: "#FF3B30",
      },
    },
  },
  plugins: [],
};
