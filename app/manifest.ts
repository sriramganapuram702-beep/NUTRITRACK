import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriTrack — Food, Nutrition & Fitness Tracker',
    short_name: 'NutriTrack',
    description: 'A modern personal nutrition and fitness tracking application with personalized targets, food journal, water, steps, and monthly analytics.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#020617',
    theme_color: '#059669',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
