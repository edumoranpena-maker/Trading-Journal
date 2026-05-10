// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Las variables VITE_* se exponen automáticamente al cliente
  // Nunca pongas secretos de servidor aquí
});
