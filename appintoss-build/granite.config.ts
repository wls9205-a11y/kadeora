import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'kadeora',
  brand: {
    displayName: '카더라',
    primaryColor: '#ff5b36',
    icon: './icon.png',
  },
  web: {
    port: 3000,
    commands: {
      dev: 'node build-web.js',
      build: 'node build-web.js',
    },
  },
  webViewProps: {
    type: 'partner',
  },
  permissions: [],
});
