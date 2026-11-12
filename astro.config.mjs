import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { lastmodForPage } from './src/lib/sitemap';

// ```kotlin title="core/Sync.kt" puts the file name on the block, shown as a header.
const codeTitle = {
  name: 'code-title',
  pre(node) {
    const title = this.options.meta?.__raw?.match(/title="([^"]+)"/)?.[1];
    if (title) node.properties['data-title'] = title;
  },
};

export default defineConfig({
  site: 'https://prempoddar.is-a.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Give each page the date of its last change, from git.
      serialize(item) {
        item.lastmod = lastmodForPage(item.url);
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'vitesse-dark', transformers: [codeTitle] },
  },
});
