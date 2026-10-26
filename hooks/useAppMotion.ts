import { useReducedMotion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

export function useAppMotion() {
  const { animationsEnabled } = useTheme();
  const systemReduced = useReducedMotion();
  return { reduced: animationsEnabled === false || systemReduced === true };
}
