import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dashboard interno de monitoreo — Vite + React.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 }, // 5174 para no chocar con el bowl (frontend/, 5173).
});
