import type { Polarity, WuXingElement } from '@mirsonix/shared';

export const ELEMENTS: { code: WuXingElement; name: string }[] = [
  { code: 'WOOD', name: 'Wood' },
  { code: 'FIRE', name: 'Fire' },
  { code: 'EARTH', name: 'Earth' },
  { code: 'METAL', name: 'Metal' },
  { code: 'WATER', name: 'Water' },
];

export const MERIDIANS: { code: string; name: string; element: WuXingElement | null; polarity: Polarity }[] = [
  { code: 'LU', name: 'Lung', element: 'METAL', polarity: 'YIN' },
  { code: 'LI', name: 'Large Intestine', element: 'METAL', polarity: 'YANG' },
  { code: 'ST', name: 'Stomach', element: 'EARTH', polarity: 'YANG' },
  { code: 'SP', name: 'Spleen', element: 'EARTH', polarity: 'YIN' },
  { code: 'HT', name: 'Heart', element: 'FIRE', polarity: 'YIN' },
  { code: 'SI', name: 'Small Intestine', element: 'FIRE', polarity: 'YANG' },
  { code: 'BL', name: 'Bladder', element: 'WATER', polarity: 'YANG' },
  { code: 'KI', name: 'Kidney', element: 'WATER', polarity: 'YIN' },
  { code: 'PC', name: 'Pericardium', element: 'FIRE', polarity: 'YIN' },
  { code: 'TE', name: 'Triple Energizer', element: 'FIRE', polarity: 'YANG' },
  { code: 'GB', name: 'Gallbladder', element: 'WOOD', polarity: 'YANG' },
  { code: 'LR', name: 'Liver', element: 'WOOD', polarity: 'YIN' },
  { code: 'GV', name: 'Governing Vessel', element: null, polarity: 'YANG' },
  { code: 'CV', name: 'Conception Vessel', element: null, polarity: 'YIN' },
];

export const ISSUES: { slug: string; name: string }[] = [
  { slug: 'back-pain', name: 'Back pain' },
  { slug: 'spine-recovery', name: 'Spine recovery' },
  { slug: 'chronic-pain', name: 'Chronic pain' },
  { slug: 'neck-and-shoulders', name: 'Neck and shoulder tension' },
  { slug: 'joint-pain', name: 'Joint pain' },
  { slug: 'headache', name: 'Headache' },
  { slug: 'sleep', name: 'Sleep' },
  { slug: 'stress-anxiety', name: 'Stress and anxiety' },
  { slug: 'digestion', name: 'Digestion' },
  { slug: 'energy-fatigue', name: 'Energy and fatigue' },
];
