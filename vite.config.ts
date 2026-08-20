// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

function patchedMcpPlugin() {
  const plugin = mcpPlugin();
  const originalConfigResolved = (plugin as any).configResolved;
  if (originalConfigResolved) {
    (plugin as any).configResolved = function (config: any) {
      const originalRoot = config.root;
      Object.defineProperty(config, "root", {
        value: originalRoot.replace(/\//g, "\\"),
        configurable: true,
      });
      const result = originalConfigResolved.call(this, config);
      Object.defineProperty(config, "root", {
        value: originalRoot,
        configurable: true,
      });
      return result;
    };
  }
  return plugin;
}

export default defineConfig({
  vite: {
    plugins: [patchedMcpPlugin()],
  },
});
