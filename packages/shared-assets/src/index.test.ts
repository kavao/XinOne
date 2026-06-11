import { describe, expect, it } from 'vitest';
import { SHARED_AUDIO, SHARED_BGM } from './index';

describe('shared audio manifest', () => {
  it('registers the shared UI click sound with a namespaced key', () => {
    expect(SHARED_AUDIO.uiClick.key).toBe('shared:sfx:ui-click');
    expect(SHARED_AUDIO.uiClick.url).toContain('ui-click.wav');
    expect(SHARED_AUDIO.uiClick.volume).toBeGreaterThan(0);
  });

  it('registers common victory and defeat jingles', () => {
    expect(SHARED_AUDIO.victory.key).toBe('shared:sfx:victory');
    expect(SHARED_AUDIO.victory.url).toContain('victory-jingle.wav');
    expect(SHARED_AUDIO.defeat.key).toBe('shared:sfx:defeat');
    expect(SHARED_AUDIO.defeat.url).toContain('defeat-jingle.wav');
  });

  it('registers the three shared BGM roles with namespaced keys', () => {
    expect(Object.keys(SHARED_BGM)).toEqual(['title', 'thoughtful', 'active']);
    expect(SHARED_BGM.title.key).toBe('shared:bgm:title-selection');
    expect(SHARED_BGM.thoughtful.key).toBe('shared:bgm:thoughtful');
    expect(SHARED_BGM.active.key).toBe('shared:bgm:active');
  });
});
