import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'kadeora',
  brand: {
    displayName: '카더라',
    primaryColor: '#2563EB',
    icon: 'https://kadeora.app/icons/icon-192.png',
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
