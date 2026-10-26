import { installDevice, needsInstallGuide } from '../services/webInstall';

describe('web installation entry policy', () => {
  it('shows first-visit browser guidance without blocking future visits or Google return', () => {
    expect(needsInstallGuide(false, false, false, false)).toBe(false);
    expect(needsInstallGuide(false, false, false, true)).toBe(true);
    expect(needsInstallGuide(false, true, false, true)).toBe(false);
    expect(needsInstallGuide(true, false, false, true)).toBe(false);
    expect(needsInstallGuide(false, false, true, true)).toBe(false);
  });
  it('recognizes iPad desktop user agents and provides the correct manual instructions', () => {
    expect(installDevice('Mozilla iPhone Safari', 1)).toBe('ios');
    expect(installDevice('Mozilla Macintosh Safari', 5)).toBe('ios');
    expect(installDevice('Mozilla Macintosh Safari', 0)).toBe('desktop');
    expect(installDevice('Mozilla Android Chrome', 5)).toBe('android');
    expect(installDevice('Mozilla Windows Chrome', 0)).toBe('desktop');
  });
});
