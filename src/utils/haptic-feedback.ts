/**
 * Trigger haptic feedback (vibration) on supported devices
 * @param intensity - 'light' (10ms), 'medium' (50ms), or 'heavy' (100ms)
 */
export const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
  // Check if vibration API is supported
  if (!navigator.vibrate) {
    return;
  }

  const durations = {
    light: 10,
    medium: 50,
    heavy: 100,
  };

  try {
    navigator.vibrate(durations[intensity]);
  } catch (error) {
    console.warn('Haptic feedback not supported:', error);
  }
};

/**
 * Trigger a pattern of haptic feedback
 * @param pattern - Array of [vibrate, pause] durations in milliseconds
 */
export const triggerHapticPattern = (pattern: number[]) => {
  if (!navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('Haptic pattern not supported:', error);
  }
};
