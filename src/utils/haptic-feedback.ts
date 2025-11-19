export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  switch (type) {
    case 'light':
s      break;
    case 'medium':
      navigator.vibrate(30);
      break;
    case 'heavy':
      navigator.vibrate(50);
      break;
    case 'success':
      navigator.vibrate([10, 30, 10]);
      break;
    case 'error':
      navigator.vibrate([50, 30, 50]);
      break;
  }
};
