import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                    graph: ['d3-force', 'force-graph'],
                },
            },
        },
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.jpg', 'icon.svg'],
            manifest: {
                name: 'NetGen',
                short_name: 'NetGen',
                description: 'Contact and professional networking manager',
                theme_color: '#111827',
                background_color: '#111827',
                display: 'standalone',
                icons: [
                    {
                        src: '/icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
            },
            // Cache the app shell only. Authenticated Firestore responses must
            // not be stored in a shared service-worker HTTP cache.
            workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
            },
        }),
    ],
});
