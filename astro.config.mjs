import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://prempoddar.is-a.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
