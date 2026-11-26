// ==========================================================================
// FEAT-001 reactions tests (spec: docs/specs/FEAT-001-reactions.md), run with `pnpm test`.
// jsdom has no media playback, so play(), pause(), load() and the paused state are mocked, as in the smoke tests.
// ==========================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import Plyr from '../src/js/plyr';

const brand = { enabled: true, channel: 'Web', brand: 'Test Brand' };
const allCodes = ['thumbs_up', 'heart', 'clap', 'wow', 'sad', 'fire', 'angry'];

function mockPlayback() {
  const paused = new WeakMap();
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function getPaused() {
    return paused.has(this) ? paused.get(this) : true;
  });
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function mockPlay() {
    paused.set(this, false);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function mockPause() {
    paused.set(this, true);
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  return { play };
}

// Players created in a test, destroyed afterwards
let players = [];

// Add a <video> (or other markup) to the document and set up a player on it
function setup(markup, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = markup;
  document.body.appendChild(wrapper);
  const player = new Plyr(wrapper.firstElementChild, { loadSprite: false, ...options });
  players.push(player);
  return player;
}

const video = (attributes = 'data-plyr-video-id="video-1"') =>
  `<video playsinline ${attributes}><source src="video.mp4" type="video/mp4"></video>`;

const el = (player) => player.elements.reactions;
const button = (player) => player.elements.container.querySelector('[data-plyr="reactions"]');
const item = (player, code) => player.elements.container.querySelector(`[data-reaction="${code}"]`);
const stored = () => JSON.parse(window.localStorage.getItem('plyr') || '{}').reactions;

// Collect `reaction` events from a player
function events(player) {
  const list = [];
  player.on('reaction', (event) => list.push(event.detail));
  return list;
}

describe('Reactions (FEAT-001)', () => {
  let media;

  beforeEach(() => {
    window.localStorage.clear();
    media = mockPlayback();
  });

  afterEach(() => {
    players.forEach((player) => player.destroy());
    players = [];
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  // R1
  it('is off by default: no button, no events, nothing stored', () => {
    const player = setup(video());
    const fired = events(player);

    expect(button(player)).toBeNull();
    expect(player.elements.reactions).toBeNull();
    player.elements.container.click();
    expect(fired).toHaveLength(0);
    expect(stored()).toBeUndefined();
  });

  // R2
  it('turns on from the options', () => {
    const player = setup(video(), { reactions: brand });
    const btn = button(player);

    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-haspopup')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe(el(player).row.id);
    expect(btn.textContent).toContain('React');
    // Placed before captions in the default control order
    const order = Array.from(player.elements.controls.children);
    expect(order.indexOf(el(player).wrapper)).toBeLessThan(order.indexOf(player.elements.settings.menu));
  });

  // R2
  it('turns on from data-plyr-config', () => {
    const player = setup(video(`data-plyr-video-id="video-1" data-plyr-config='{"reactions":{"enabled":true}}'`));

    expect(button(player)).not.toBeNull();
  });

  // R2
  it('shares one brand config across videos with different IDs', () => {
    const one = setup(video('data-plyr-video-id="a"'), { reactions: brand });
    const two = setup(video('data-plyr-video-id="b"'), { reactions: brand });
    const firedOne = events(one);
    const firedTwo = events(two);

    item(one, 'heart').click();
    item(two, 'fire').click();

    expect(firedOne[0].video_id).toBe('a');
    expect(firedTwo[0].video_id).toBe('b');
    expect(stored()).toEqual({ a: 'heart', b: 'fire' });
  });

  // R2: a brand's own controls list without 'reactions'
  it('adds the control before fullscreen when the brand controls list lacks it', () => {
    const player = setup(video(), { reactions: brand, controls: ['play', 'progress', 'fullscreen'] });
    const children = Array.from(player.elements.controls.children);

    expect(button(player)).not.toBeNull();
    expect(children[children.length - 1].getAttribute('data-plyr')).toBe('fullscreen');
    expect(children[children.length - 2]).toBe(el(player).wrapper);
  });

  // R3
  it('takes the video ID from the attribute, then the option; the attribute wins', () => {
    const fromAttribute = setup(video('data-plyr-video-id="attr-id"'), { reactions: brand });
    const fromOption = setup(video(''), { reactions: brand, videoId: 'option-id' });
    const both = setup(video('data-plyr-video-id="attr-wins"'), { reactions: brand, videoId: 'option-loses' });

    expect(fromAttribute.reactions.videoId).toBe('attr-id');
    expect(fromOption.reactions.videoId).toBe('option-id');
    expect(both.reactions.videoId).toBe('attr-wins');
  });

  // R3
  it('shows no button and warns when the video has no ID', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const player = setup(video(''), { reactions: brand, debug: true });
    const other = setup(video('data-plyr-video-id="ok"'), { reactions: brand });

    expect(button(player)).toBeNull();
    expect(warn.mock.calls.some((args) => args.join(' ').includes('no ID'))).toBe(true);
    expect(button(other)).not.toBeNull();
  });

  // R4
  it('shows no button on audio', () => {
    const player = setup('<audio data-plyr-video-id="a1"><source src="a.mp3" type="audio/mp3"></audio>', {
      reactions: brand,
    });

    expect(button(player)).toBeNull();
  });

  // R5, R14
  it('opens and closes the row with the button, Escape and an outside click', () => {
    const player = setup(video(), { reactions: brand });
    const { row } = el(player);
    const btn = button(player);

    btn.click();
    expect(row.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(player.elements.container.classList.contains('plyr--reactions-open')).toBe(true);

    btn.click();
    expect(row.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    btn.click();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(row.hidden).toBe(true);
    expect(document.activeElement).toBe(btn);

    btn.click();
    document.body.click();
    expect(row.hidden).toBe(true);
  });

  // R6
  it('shows the 7 default reactions in order, with labels', () => {
    const player = setup(video(), { reactions: brand });
    const items = el(player).items;

    expect(items.map((i) => i.getAttribute('data-reaction'))).toEqual(allCodes);
    expect(items.map((i) => i.textContent)).toEqual([
      '👍Thumbs up',
      '❤️Heart',
      '👏Clap',
      '😲Wow',
      '😢Sad',
      '🔥Fire',
      '😡Angry',
    ]);
    expect(el(player).row.getAttribute('role')).toBe('group');
    expect(el(player).row.getAttribute('aria-label')).toBe('Reactions');
  });

  // R6
  it("uses the brand's subset and order, dropping unknown codes and duplicates", () => {
    const player = setup(video(), {
      reactions: { ...brand, options: ['fire', 'heart', 'unknown', 'fire', 'laugh'] },
    });

    expect(el(player).items.map((i) => i.getAttribute('data-reaction'))).toEqual(['fire', 'heart']);
  });

  // R7, R11, R12
  it('picking a reaction closes the row, shows it on the button and fires the event', () => {
    const player = setup(video(), { reactions: { ...brand, channel: 'Mobile' } });
    const fired = events(player);
    const btn = button(player);

    btn.click();
    item(player, 'heart').click();

    expect(el(player).row.hidden).toBe(true);
    expect(el(player).current.textContent).toBe('❤️');
    expect(el(player).current.hidden).toBe(false);
    expect(btn.textContent).toContain('React, current reaction: Heart');
    expect(item(player, 'heart').getAttribute('aria-pressed')).toBe('true');
    expect(item(player, 'fire').getAttribute('aria-pressed')).toBe('false');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ video_id: 'video-1', reaction: 'heart', channel: 'Mobile', brand: 'Test Brand' });
    expect(fired[0].plyr).toBe(player);
  });

  // R8, R10
  it('switches to a different reaction, and removes it when picked again', () => {
    const player = setup(video(), { reactions: brand });
    const fired = events(player);

    item(player, 'heart').click();
    item(player, 'fire').click();
    expect(stored()).toEqual({ 'video-1': 'fire' });
    expect(el(player).items.filter((i) => i.getAttribute('aria-pressed') === 'true')).toHaveLength(1);

    item(player, 'fire').click();
    expect(stored()).toBeUndefined();
    expect(el(player).current.hidden).toBe(true);
    expect(button(player).textContent).toContain('React');
    expect(fired.map((d) => d.reaction)).toEqual(['heart', 'fire', 'removed']);
  });

  // R10: other stored settings are kept
  it('stores only the video ID and code, alongside existing Plyr storage', () => {
    window.localStorage.setItem('plyr', JSON.stringify({ volume: 0.5 }));
    const player = setup(video(), { reactions: brand });

    item(player, 'clap').click();
    expect(JSON.parse(window.localStorage.getItem('plyr'))).toEqual({ volume: 0.5, reactions: { 'video-1': 'clap' } });

    item(player, 'clap').click();
    expect(JSON.parse(window.localStorage.getItem('plyr'))).toEqual({ volume: 0.5 });
  });

  // R9, R11
  it('remembers the reaction for the same video without firing an event', () => {
    const first = setup(video(), { reactions: brand });
    item(first, 'wow').click();
    first.destroy();
    players = [];
    document.body.innerHTML = '';

    const fired = [];
    document.addEventListener('reaction', (event) => fired.push(event), { once: true });
    const again = setup(video(), { reactions: brand });
    const other = setup(video('data-plyr-video-id="video-2"'), { reactions: brand });

    expect(again.reactions.current).toBe('wow');
    expect(el(again).current.textContent).toBe('😲');
    expect(item(again, 'wow').getAttribute('aria-pressed')).toBe('true');
    expect(other.reactions.current).toBeNull();
    expect(fired).toHaveLength(0);
  });

  // §3.5: storage blocked or disabled
  it('still works and fires events when storage is blocked or disabled', () => {
    const disabled = setup(video(), { reactions: brand, storage: { enabled: false } });
    const firedDisabled = events(disabled);
    item(disabled, 'sad').click();
    expect(firedDisabled[0].reaction).toBe('sad');
    expect(window.localStorage.getItem('plyr')).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const blocked = setup(video('data-plyr-video-id="video-3"'), { reactions: brand });
    const firedBlocked = events(blocked);
    item(blocked, 'angry').click();
    expect(firedBlocked[0].reaction).toBe('angry');
    expect(blocked.reactions.current).toBe('angry');
  });

  // R14
  it('supports keyboard navigation in the row, without triggering player shortcuts', async () => {
    const player = setup(video(), { reactions: brand });
    await new Promise((resolve) => player.once('ready', resolve));
    const { row, items } = el(player);
    const key = (name) =>
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

    button(player).click();
    expect(document.activeElement).toBe(items[0]);

    key('ArrowRight');
    expect(document.activeElement).toBe(items[1]);
    key('ArrowLeft');
    key('ArrowLeft');
    expect(document.activeElement).toBe(items[items.length - 1]);
    key('Home');
    expect(document.activeElement).toBe(items[0]);
    key('End');
    expect(document.activeElement).toBe(items[items.length - 1]);

    // Space on a reaction doesn't toggle playback
    key(' ');
    expect(media.play).not.toHaveBeenCalled();
    expect(row.hidden).toBe(false);

    // Opening again focuses the current reaction
    item(player, 'clap').click();
    button(player).click();
    expect(document.activeElement).toBe(item(player, 'clap'));
  });

  // R9, R16
  it('makes no network requests', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open');

    const player = setup(video(), { reactions: brand });
    button(player).click();
    item(player, 'thumbs_up').click();
    item(player, 'thumbs_up').click();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // R18: the demo sets the ratio when the player is created (the runtime setter is broken, #5)
  it("applies ratio: '9:16' when set at creation", () => {
    const player = setup(video(), { reactions: brand, ratio: '9:16' });

    expect(player.ratio).toBe('9:16');
  });
});
