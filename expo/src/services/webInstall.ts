export const INSTALL_GUIDE_KEY = '8playo.install-guide-seen.v1';
export type InstallDevice = 'ios' | 'android' | 'desktop';
export function installDevice(userAgent: string, touchPoints: number): InstallDevice {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return 'ios';
  return /Android/i.test(userAgent) ? 'android' : 'desktop';
}
export function needsInstallGuide(installed: boolean, seen: boolean, returningFromGoogle: boolean): boolean {
  return !installed && !seen && !returningFromGoogle;
}
