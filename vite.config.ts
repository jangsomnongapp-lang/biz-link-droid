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
  const originalConfigResolved = plugin.configResolved;
  if (!originalConfigResolved) return plugin;

  plugin.configResolved = function (config) {
    const originalRoot = config.root;
    // Workaround for @lovable.dev/mcp-js Windows path separator bug:
    // Vite sets config.root with forward slashes, but the plugin uses
    // path.resolve (backslashes on Windows) and does a naive string prefix
    // check that fails when the separators differ.
    Object.defineProperty(config, "root", {
      value: originalRoot.replace(/\//g, "\\"),
      writable: true,
      configurable: true,
    });
    try {
      return originalConfigResolved.call(this, config);
    } finally {
      Object.defineProperty(config, "root", {
        value: originalRoot,
        writable: true,
        configurable: true,
      });
    }
  };

  return plugin;
}

export default defineConfig({
  vite: {
    plugins: [patchedMcpPlugin()],
  },
});
