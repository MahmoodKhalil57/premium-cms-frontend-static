// Static-frontend project: renders the public site with EmDash's data layer,
// no local backend and no Cloudflare adapter. Two data modes, picked by env:
//
//  - LIVE (default for `bun dev`): BACKEND_URL + EMDASH_API_TOKEN set — getDb()
//    reads an in-memory database continuously refreshed from the live backend's
//    /_emdash/api/snapshot (@premium-cms/emdash/db/snapshot-live). Publish in
//    the admin, reload the page: no snapshot file, no pull step. /_emdash/* on
//    the dev server proxies to the backend, same-origin like the previews.
//  - FILE (the platform's container builds): EMDASH_SNAPSHOT_DB points at a
//    snapshot.db materialized by bin/snapshot-to-sqlite.mjs; `astro build`
//    renders from it (GitHub Pages hosting).
import react from "@astrojs/react";
import icon from "astro-iconset";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "@premium-cms/emdash/astro";
import { readFileSync } from "node:fs";

// `bun run` / `npm run` do not always hand .env to the astro process: load it
// ourselves — only for variables that are not already set.
try {
	for (const line of readFileSync(".env", "utf8").split("\n")) {
		const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
} catch {
	// no .env — the environment must carry the values
}

const snapshotFile = process.env.EMDASH_SNAPSHOT_DB;
const backend = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
const liveMode = !snapshotFile && !!backend && !!process.env.EMDASH_API_TOKEN;

const database = liveMode
	? {
			entrypoint: "@premium-cms/emdash/db/snapshot-live",
			config: {
				url: backend,
				token: process.env.EMDASH_API_TOKEN,
				includeDrafts: ["1", "true"].includes(process.env.EMDASH_INCLUDE_DRAFTS || ""),
			},
			type: "sqlite",
			supportsRequestScope: false,
			supportsCoalescing: false,
			supportsCollectionDeletionGuard: false,
		}
	: {
			entrypoint: "@premium-cms/emdash/db/sqlite",
			config: { url: `file:${snapshotFile || "snapshot.db"}` },
			type: "sqlite",
			migrations: {
				entrypoint: "@premium-cms/emdash/db/sqlite-migrations",
				manifestConfig: { url: `file:${snapshotFile || "snapshot.db"}` },
			},
			supportsRequestScope: false,
			supportsCoalescing: false,
			supportsCollectionDeletionGuard: false,
		};

// On GitHub Pages project sites the URL is <user>.github.io/<repo>, so split
// SITE_URL into the origin (site) and the subpath (base) — otherwise assets are
// linked at /_astro/… and 404. A custom domain sets SITE_URL to the root, so
// base becomes "/" automatically.
const _rawSite = process.env.SITE_URL || "https://example.com";
let _site = _rawSite, _base = "/";
try { const u = new URL(_rawSite); _site = u.origin; _base = u.pathname.replace(/\/+$/, "") || "/"; } catch {}

export default defineConfig({
	output: "static",
	site: _site,
	base: _base,
	image: { layout: "constrained", responsiveStyles: true },
	// In live mode the dev server forwards backend API calls (forms, commerce,
	// auth) to the live instance, so client-side features work same-origin.
	vite: liveMode
		? { server: { proxy: { "/_emdash": { target: backend, changeOrigin: true } } } }
		: {},
	integrations: [
		react(),
		icon({ include: { ph: ["chart-bar","check-circle","clock","cloud","code","currency-dollar","envelope","globe","heart","lifebuoy","lightning","lock","shield-check","sparkle","star","users-three"] } }),
		emdash({
			database,
			staticFrontend: true,
			plugins: [
				{
					id: "marketing-blocks",
					version: "0.1.0",
					entrypoint: new URL("./src/plugins/marketing-blocks/index.ts", import.meta.url).href,
				},
			],
		}),
	],
	fonts: [
		{ provider: fontProviders.google(), name: "Inter", cssVariable: "--font-body", weights: [400,500,600,700,800], fallbacks: ["sans-serif"] },
	],
	devToolbar: { enabled: false },
});
