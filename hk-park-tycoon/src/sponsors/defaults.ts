/**
 * Default branding for all sponsorable entities.
 * This is the source of truth for "what things look like without sponsors."
 * Every entity ships with beautiful HK-themed defaults.
 * When a sponsor is active, their assets overlay these.
 */

import { SponsorableEntity } from '../engine/types';

// -- Shops ------------------------------------------------------------------

export const shopDefaults: Record<string, SponsorableEntity> = {
  'bubble-tea-bar': {
    defaultName: 'Bubble Tea Bar',
    defaultIcon: '🧋',
    defaultDescription: 'Refreshing pearl milk tea',
    defaultColorScheme: '#8B6914',
    sponsor: null,
  },
  'dai-pai-dong': {
    defaultName: 'Dai Pai Dong',
    defaultIcon: '🍜',
    defaultDescription: 'Authentic street food stall',
    defaultColorScheme: '#D4543A',
    sponsor: null,
  },
  'egg-waffle-stand': {
    defaultName: 'Egg Waffle Stand',
    defaultIcon: '🧇',
    defaultDescription: 'Classic HK egg waffles',
    defaultColorScheme: '#E8A317',
    sponsor: null,
  },
  'milk-tea-shop': {
    defaultName: 'Milk Tea Shop',
    defaultIcon: '🫖',
    defaultDescription: 'HK-style silk stocking milk tea',
    defaultColorScheme: '#8B4513',
    sponsor: null,
  },
  'noodle-house': {
    defaultName: 'Noodle House',
    defaultIcon: '🍝',
    defaultDescription: 'Wonton noodle soup',
    defaultColorScheme: '#CD853F',
    sponsor: null,
  },
  'souvenir-pagoda': {
    defaultName: 'Souvenir Pagoda',
    defaultIcon: '🏮',
    defaultDescription: 'HK-themed gifts and trinkets',
    defaultColorScheme: '#B22222',
    sponsor: null,
  },
  'ice-cream-junk': {
    defaultName: 'Ice Cream Junk',
    defaultIcon: '🍦',
    defaultDescription: 'Boat-shaped ice cream parlour',
    defaultColorScheme: '#FF69B4',
    sponsor: null,
  },
  'first-aid-station': {
    defaultName: 'First Aid Station',
    defaultIcon: '🏥',
    defaultDescription: 'Medical assistance tent',
    defaultColorScheme: '#FFFFFF',
    sponsor: null,
  },
};

// -- Rides ------------------------------------------------------------------

export const rideDefaults: Record<string, SponsorableEntity> = {
  'dragon-coaster': {
    defaultName: 'Dragon Coaster',
    defaultIcon: '🐉',
    defaultDescription: 'A roaring dragon-themed roller coaster',
    defaultColorScheme: '#FF4500',
    sponsor: null,
  },
  'junk-boat-cruise': {
    defaultName: 'Junk Boat Cruise',
    defaultIcon: '⛵',
    defaultDescription: 'Relaxing harbour cruise on a traditional junk',
    defaultColorScheme: '#8B4513',
    sponsor: null,
  },
  'peak-tram-drop-tower': {
    defaultName: 'Peak Tram Drop Tower',
    defaultIcon: '🗼',
    defaultDescription: 'Plunge from the top of Victoria Peak',
    defaultColorScheme: '#4169E1',
    sponsor: null,
  },
  'dim-sum-spinner': {
    defaultName: 'Dim Sum Spinner',
    defaultIcon: '🥟',
    defaultDescription: 'Spinning dim sum baskets — hold on tight!',
    defaultColorScheme: '#DAA520',
    sponsor: null,
  },
  'neon-night-flyer': {
    defaultName: 'Neon Night Flyer',
    defaultIcon: '🌃',
    defaultDescription: 'A neon-lit nighttime thrill ride',
    defaultColorScheme: '#FF00FF',
    sponsor: null,
  },
  'temple-garden-train': {
    defaultName: 'Temple Garden Train',
    defaultIcon: '🚂',
    defaultDescription: 'Scenic train through temple gardens',
    defaultColorScheme: '#228B22',
    sponsor: null,
  },
  'harbour-ferris-wheel': {
    defaultName: 'Harbour Ferris Wheel',
    defaultIcon: '🎡',
    defaultDescription: 'Panoramic views of Victoria Harbour',
    defaultColorScheme: '#1E90FF',
    sponsor: null,
  },
  'typhoon-twister': {
    defaultName: 'Typhoon Twister',
    defaultIcon: '🌀',
    defaultDescription: 'A wild spinning coaster inspired by HK typhoons',
    defaultColorScheme: '#696969',
    sponsor: null,
  },
  'bamboo-scaffold-climb': {
    defaultName: 'Bamboo Scaffold Climb',
    defaultIcon: '🎋',
    defaultDescription: 'Climb traditional bamboo scaffolding',
    defaultColorScheme: '#6B8E23',
    sponsor: null,
  },
  'lion-dance-carousel': {
    defaultName: 'Lion Dance Carousel',
    defaultIcon: '🦁',
    defaultDescription: 'A gentle carousel with lion dance mounts',
    defaultColorScheme: '#FF6347',
    sponsor: null,
  },
  'star-ferry-splash': {
    defaultName: 'Star Ferry Splash',
    defaultIcon: '🚢',
    defaultDescription: 'Water ride inspired by the iconic Star Ferry',
    defaultColorScheme: '#20B2AA',
    sponsor: null,
  },
  'kowloon-walled-city-maze': {
    defaultName: 'Kowloon Walled City Maze',
    defaultIcon: '🏚️',
    defaultDescription: 'Navigate the legendary Walled City',
    defaultColorScheme: '#708090',
    sponsor: null,
  },
};

// -- Districts --------------------------------------------------------------

export const districtDefaults: Record<string, SponsorableEntity> = {
  'mong-kok-market': {
    defaultName: 'Mong Kok Market',
    defaultIcon: '🏪',
    defaultDescription: 'A bustling street market area',
    defaultColorScheme: '#FF8C00',
    sponsor: null,
  },
  'tsim-sha-tsui-waterfront': {
    defaultName: 'Tsim Sha Tsui Waterfront',
    defaultIcon: '🌊',
    defaultDescription: 'Premium tourist district along Victoria Harbour',
    defaultColorScheme: '#4682B4',
    sponsor: null,
  },
  'lantau-highlands': {
    defaultName: 'Lantau Highlands',
    defaultIcon: '⛰️',
    defaultDescription: 'Remote and spacious highlands',
    defaultColorScheme: '#2E8B57',
    sponsor: null,
  },
  'central-business-district': {
    defaultName: 'Central Business District',
    defaultIcon: '🏙️',
    defaultDescription: 'The most expensive land in Hong Kong',
    defaultColorScheme: '#C0C0C0',
    sponsor: null,
  },
  'aberdeen-fishing-village': {
    defaultName: 'Aberdeen Fishing Village',
    defaultIcon: '🎣',
    defaultDescription: 'Traditional fishing village',
    defaultColorScheme: '#5F9EA0',
    sponsor: null,
  },
  'kowloon-peak': {
    defaultName: 'Kowloon Peak',
    defaultIcon: '🏔️',
    defaultDescription: 'Elevation changes for thrill rides',
    defaultColorScheme: '#556B2F',
    sponsor: null,
  },
};

// -- All defaults combined --------------------------------------------------

export const allDefaults: Record<string, SponsorableEntity> = {
  ...shopDefaults,
  ...rideDefaults,
  ...districtDefaults,
};
