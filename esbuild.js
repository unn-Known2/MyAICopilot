#!/usr/bin/env node
const esbuild = require("esbuild");
const { promises: fs } = require("fs");

async function build() {
  const baseConfig = {
    entryPoints: ["src/extension.ts"],
    bundle: true,
    external: ["vscode"],
    format: "cjs",
    target: "es2022",
    minify: false,
    sourcemap: true,
    metafile: true,
    logLevel: "info",
  };

  try {
    // Clean output directory
    await fs.rm("out", { recursive: true, force: true });
    await fs.mkdir("out", { recursive: true });

    // Desktop build
    await esbuild.build({
      ...baseConfig,
      outfile: "out/extension.js",
      platform: "node",
      footer: {
        js: "module.exports = exports;",
      },
    });

    // Web build
    await esbuild.build({
      ...baseConfig,
      entryPoints: ["src/extension.web.ts"],
      outfile: "out/extension.web.js",
      platform: "browser",
      define: {
        "process.env.NODE_ENV": '"production"',
        global: "globalThis",
        Buffer: "undefined",
      },
      banner: {
        js: "const globalThis = globalThis || self;",
      },
    });

    console.log("✅ Both builds completed successfully");
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
}

build();
