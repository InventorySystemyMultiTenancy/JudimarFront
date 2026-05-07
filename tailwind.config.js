/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta Traditional-Bar — Judimar
        primary: "#262626", // Preto grafite do logo
        secondary: "#D35400", // Laranja queimado do '1983'
        accent: "#F4EBD0", // Bege creme para fundos suaves
        "accent-dark": "#E8D9B5", // Bege mais escuro para bordas/hover
        "text-main": "#333333",
        "text-muted": "#666666",
        "card-bg": "#FFFFFF",
        "border-soft": "#D9C9A8",
        // Aliases legados mantidos para compatibilidade
        ink: "#F4EBD0",
        ember: "#D35400",
        gold: "#D35400",
        lacquer: "#FFFFFF",
        smoke: "#666666",
        cream: "#262626",
        rosso: "#B84600",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["Montserrat", "Inter", "sans-serif"],
        // alias legado
        script: ["Playfair Display", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.09)",
        glow: "0 0 0 1px rgba(211,84,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        texture:
          "radial-gradient(circle at 10% 20%, rgba(211,84,0,0.04), transparent 40%), radial-gradient(circle at 90% 0%, rgba(38,38,38,0.03), transparent 45%)",
      },
    },
  },
  plugins: [],
};
