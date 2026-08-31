// Static-frontend project: renders the public site with EmDash's data layer,
// live-connected to the deployed backend — no local backend, no snapshot file,
// no Cloudflare adapter. getDb() reads an in-memory database built from the
// backend's /_emdash/api/snapshot (@premium-cms/emdash/db/snapshot-live):
// `astro dev` keeps it refreshed (publish in the admin, reload the page) and
// the platform's container `astro build` renders from one frozen fetch of the
// same source. /_emdash/* on the dev server proxies to the backend, so
// client-side features and the editor session work same-origin.
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

const backend = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
if (!backend || !process.env.EMDASH_API_TOKEN) {
	throw new Error(
		"BACKEND_URL and EMDASH_API_TOKEN are required — copy .env.example to .env (admins: <site>/_emdash/api/settings/frontend-token).",
	);
}

const database = {
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
	// The dev server forwards backend API calls (forms, commerce, auth, the
	// editor session) to the live instance; ignored by `astro build`.
	vite: { server: { proxy: { "/_emdash": { target: backend, changeOrigin: true } } } },
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
