// Static-frontend build: renders the public site to static HTML from a local
// SQLite snapshot (bin/snapshot-to-sqlite.mjs), for hosting on GitHub Pages.
// No Cloudflare adapter, no Worker — EmDash's getDb() points at the snapshot
// file via a raw @premium-cms/emdash/db/sqlite descriptor, so the existing
// frontend data layer renders unchanged.
import react from "@astrojs/react";
import icon from "astro-iconset";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "@premium-cms/emdash/astro";

const snapshotFile = process.env.EMDASH_SNAPSHOT_DB || "snapshot.db";

const sqliteDatabase = {
	entrypoint: "@premium-cms/emdash/db/sqlite",
	config: { url: `file:${snapshotFile}` },
	type: "sqlite",
	migrations: { entrypoint: "@premium-cms/emdash/db/sqlite-migrations", manifestConfig: { url: `file:${snapshotFile}` } },
	supportsRequestScope: false,
	supportsCoalescing: false,
	supportsCollectionDeletionGuard: false,
};

export default defineConfig({
	output: "static",
	site: process.env.SITE_URL || "https://example.com",
	image: { layout: "constrained", responsiveStyles: true },
	integrations: [
		react(),
		icon({ include: { ph: ["chart-bar","check-circle","clock","cloud","code","currency-dollar","envelope","globe","heart","lifebuoy","lightning","lock","shield-check","sparkle","star","users-three"] } }),
		emdash({
			database: sqliteDatabase,
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
