import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
	optimizeDeps: {
		include: ["blockly"],
	},
	plugins: [react(), svgr()],
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	build: {
		commonjsOptions: {
			include: [/node_modules/],
		},
		rollupOptions: {
			output: {
				manualChunks: {
					blockly: ["blockly"],
				},
			},
		},
	},
});
