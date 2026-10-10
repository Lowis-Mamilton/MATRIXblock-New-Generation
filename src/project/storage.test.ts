import { describe, expect, it } from 'vitest';
import { exportMethods } from './storage';
import { isIOS } from '../platform';

describe('exportMethods', () => {
  it('prefers the native save dialog on desktop Chrome / Edge', () => {
    expect(exportMethods({ savePicker: true, shareFiles: false, ios: false })).toEqual(['picker', 'download', 'manual']);
  });

  it('uses the share sheet on iOS and never a silent <a download>', () => {
    expect(exportMethods({ savePicker: false, shareFiles: true, ios: true })).toEqual(['share', 'manual']);
  });

  it('falls back to showing the project text when an iOS browser cannot share files (Bluefy)', () => {
    expect(exportMethods({ savePicker: false, shareFiles: false, ios: true })).toEqual(['manual']);
  });

  it('downloads on other browsers without a save dialog', () => {
    expect(exportMethods({ savePicker: false, shareFiles: false, ios: false })).toEqual(['download', 'manual']);
  });
});

describe('isIOS', () => {
  const nav = (userAgent: string, platform: string, maxTouchPoints: number) => ({ userAgent, platform, maxTouchPoints });
  it('recognises iPhone, iPad and iPadOS desktop mode', () => {
    expect(isIOS(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5))).toBe(true);
    expect(isIOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5))).toBe(true);
  });
  it('does not mistake a Mac or Windows PC for iOS', () => {
    expect(isIOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0))).toBe(false);
    expect(isIOS(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10))).toBe(false);
  });
});
