# prempoddar.is-a.dev

My personal site: apps, client work, writing, a toolbox of things I recommend, and my resume.

Built with Astro. Every push to `main` runs the tests, builds the site and deploys it to GitHub Pages.

## Run it locally

```sh
npm install
npm run dev      # http://localhost:4321
npm test
npm run build    # builds into dist/ and checks the output
```

`npm run build` fails if the output contains something that should never go public, like my phone number. The checks live in `scripts/check-dist.mjs`.

## Adding things

- **A post or guide:** add a Markdown file to `src/content/writing/`. Set `draft: true` while you're still working on it. Drafts show up in `npm run dev` but never on the live site.
- **A toolbox entry:** add an entry to `src/content/toolbox.yaml`. Put its icon in `public/toolbox/<id>.png`, or run `node scripts/fetch-favicons.mjs` to fetch any that are missing.
- **An app:** add a Markdown file to `src/content/apps/` and its images to `public/apps/<slug>/`. To put it on the homepage desk, add it to `src/data/canvas.ts`.

## One-time setup

1. In the repo settings, go to **Pages** and set the source to **GitHub Actions**.
2. Register `prempoddar.is-a.dev` at [is-a.dev](https://github.com/is-a-dev/register) with a CNAME record pointing to `prempoddar.github.io`.
3. Back in **Pages**, set the custom domain to `prempoddar.is-a.dev` and turn on **Enforce HTTPS**.

`public/CNAME` already contains the domain, so it survives every deploy.

## SEO notes

- The sitemap (`/sitemap-index.xml`) is generated at build time from the built pages, with lastmod dates read from git history. Adding a page needs no sitemap work.
- A new **subdomain** is a separate site to search engines: it needs its own sitemap, its own robots.txt and its own Search Console and Bing properties.
- Structured data lives in `src/lib/seo.ts`, rendered by `src/components/JsonLd.astro`. `Base.astro` puts Person and WebSite schema on every page, app pages add SoftwareApplication, writing posts add BlogPosting. Copy the existing pattern when adding a new page type.
- Adding an app also means updating the hand-written app lists: the description in `src/pages/apps/index.astro` and the list line in `src/pages/index.astro`, plus the app card in `src/data/canvas.ts`.
- Google Search Console is verified with a meta tag in `src/layouts/Base.astro`. New pages are discovered on their own; "Request Indexing" in Search Console just speeds it up.

