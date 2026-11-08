import { describe, expect, it, vi } from 'vitest';
import { hideSceneLoading, SHARED_AUDIO, SHARED_BGM, showSceneLoading } from './index';

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
    expect(SHARED_AUDIO.pause.key).toBe('shared:sfx:pause');
    expect(SHARED_AUDIO.pause.url).toContain('pause.wav');
  });

  it('registers the four shared BGM roles with namespaced keys', () => {
    expect(Object.keys(SHARED_BGM)).toEqual(['title', 'thoughtful', 'active', 'upbeat']);
    expect(SHARED_BGM.title.key).toBe('shared:bgm:title-selection');
    expect(SHARED_BGM.thoughtful.key).toBe('shared:bgm:thoughtful');
    expect(SHARED_BGM.active.key).toBe('shared:bgm:active');
    expect(SHARED_BGM.upbeat.key).toBe('shared:bgm:upbeat');
  });
});

describe('scene loading overlay', () => {
  function fakeScene(pending: number) {
    const label = { setText: vi.fn(), active: true, setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setName: vi.fn().mockReturnThis(), destroy: vi.fn() };
    const children = { getByName: vi.fn().mockReturnValue(undefined), named: undefined as { destroy: () => void } | undefined };
    children.getByName = vi.fn((name: string) => (name === 'xinone:loading' ? children.named : undefined));
    const scene = {
      load: { list: { size: pending }, totalToLoad: pending, on: vi.fn() },
      children,
      add: {
        text: vi.fn(() => {
          children.named = label as never;
          return label;
        }),
      },
    };
    return { scene: scene as never, label, children };
  }

  it('does not draw LOADING when nothing is queued', () => {
    const { scene, label } = fakeScene(0);
    showSceneLoading(scene);
    expect(label.setText).not.toHaveBeenCalled();
  });

  it('draws LOADING while files are queued and removes it afterward', () => {
    const { scene, children } = fakeScene(3);
    showSceneLoading(scene);
    expect(scene.add.text).toHaveBeenCalledWith(640, 360, 'LOADING', expect.any(Object));
    hideSceneLoading(scene);
    expect(children.named?.destroy).toHaveBeenCalledOnce();
  });
});
