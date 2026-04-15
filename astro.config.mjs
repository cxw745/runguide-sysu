import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  site: 'https://sysu-leap.vercel.app',
  prefetch: {
    prefetchAll: true,
  },
});
