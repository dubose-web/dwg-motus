import type { Easing } from '../types.js';

/**
 * The CSS-native keywords (`ease`, `linear`, `ease-in`, `ease-out`,
 * `ease-in-out`) are deliberately absent — the fallthrough returns them
 * unchanged, and that same fallthrough is what lets a raw `cubic-bezier(...)`
 * value through untouched.
 */
const EASING_MAP: Record<string, string> = {
  'ease-in-back': 'cubic-bezier(.6, -.28, .735, .045)',
  'ease-out-back': 'cubic-bezier(.175, .885, .32, 1.275)',
  'ease-in-out-back': 'cubic-bezier(.68, -.55, .265, 1.55)',

  'ease-in-sine': 'cubic-bezier(.47, 0, .745, .715)',
  'ease-out-sine': 'cubic-bezier(.39, .575, .565, 1)',
  'ease-in-out-sine': 'cubic-bezier(.445, .05, .55, .95)',

  'ease-in-quad': 'cubic-bezier(.55, .085, .68, .53)',
  'ease-out-quad': 'cubic-bezier(.25, .46, .45, .94)',
  'ease-in-out-quad': 'cubic-bezier(.455, .03, .515, .955)',

  'ease-in-cubic': 'cubic-bezier(.55, .055, .675, .19)',
  'ease-out-cubic': 'cubic-bezier(.215, .61, .355, 1)',
  'ease-in-out-cubic': 'cubic-bezier(.645, .045, .355, 1)',

  'ease-in-quart': 'cubic-bezier(.895, .03, .685, .22)',
  'ease-out-quart': 'cubic-bezier(.165, .84, .44, 1)',
  'ease-in-out-quart': 'cubic-bezier(.77, 0, .175, 1)',
};

export const resolveEasing = (name: Easing): string => EASING_MAP[name] ?? name;
