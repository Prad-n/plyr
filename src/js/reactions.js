// ==========================================================================
// Plyr reactions (FEAT-001)
// One reaction per viewer per video: remembered on the device, fired as a `reaction` event.
// Spec: docs/specs/FEAT-001-reactions.md
// ==========================================================================

import { createElement, setFocus, toggleClass, toggleHidden } from './utils/elements';
import { on, triggerEvent } from './utils/events';
import i18n from './utils/i18n';
import is from './utils/is';
import { replaceAll } from './utils/strings';

// The reactions and their emoji, in the order shown. The set is fixed: brands can't change it.
export const reactionTypes = {
  thumbs_up: '👍',
  heart: '❤️',
  clap: '👏',
  wow: '😲',
  sad: '😢',
  fire: '🔥',
  angry: '😡',
};

const codes = Object.keys(reactionTypes);

// Storage key (inside Plyr's own storage object): { [videoId]: code }
const storageKey = 'reactions';

// Inline icon, so it works with the CDN sprite and makes no request
const iconPath =
  'M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1zm0 14.4A6.4 6.4 0 1 1 9 2.6a6.4 6.4 0 0 1 0 12.8zM6.3 8a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2zm5.4 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2zM9 13.3c1.8 0 3.3-1.1 3.9-2.8H5.1c.6 1.7 2.1 2.8 3.9 2.8z';

const reactions = {
  // Get the video ID: `data-plyr-video-id` on the media element wins over the `videoId` option
  getVideoId() {
    const attribute = this.media.getAttribute('data-plyr-video-id');
    const id = is.empty(attribute) ? this.config.videoId : attribute;
    return is.string(id) || is.number(id) ? String(id).trim() : '';
  },

  // Whether reactions should be built for this player
  isEnabled() {
    const { enabled } = this.config.reactions || {};

    if (enabled !== true || !this.isHTML5 || !this.isVideo) {
      return false;
    }

    if (is.empty(reactions.getVideoId.call(this))) {
      this.debug.warn('Reactions are enabled but the video has no ID (data-plyr-video-id or videoId)');
      return false;
    }

    return true;
  },

  // Read and write the stored reaction for this video
  getStored() {
    const store = this.storage.get(storageKey);
    const code = is.object(store) ? store[this.reactions.videoId] : null;
    return codes.includes(code) ? code : null;
  },

  setStored(code) {
    const store = this.storage.get(storageKey);
    const next = is.object(store) ? { ...store } : {};

    if (code) {
      next[this.reactions.videoId] = code;
    } else {
      delete next[this.reactions.videoId];
    }

    this.storage.replace(storageKey, is.empty(next) ? undefined : next);
  },

  // Build the React button and the reaction row; returns the wrapper, or null if reactions are off
  create(attributes) {
    if (!reactions.isEnabled.call(this)) {
      return null;
    }

    const { config } = this;
    const { hidden: srOnly, control } = config.classNames;
    const rowId = `plyr-reactions-${this.id}`;

    this.reactions = {
      videoId: reactions.getVideoId.call(this),
      current: null,
    };

    const wrapper = createElement('div', {
      class: `${attributes.class} plyr__reactions`.trim(),
    });

    // React button
    const button = createElement('button', {
      type: 'button',
      class: control,
      'data-plyr': 'reactions',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      'aria-controls': rowId,
    });

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 18 18');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', iconPath);
    icon.appendChild(path);

    const current = createElement('span', { class: 'plyr__reactions__current', 'aria-hidden': 'true', hidden: '' });
    const label = createElement('span', { class: srOnly });

    button.appendChild(icon);
    button.appendChild(current);
    button.appendChild(label);

    // Reaction row
    const row = createElement('div', {
      class: 'plyr__reactions__row',
      id: rowId,
      role: 'group',
      'aria-label': i18n.get('reactions', config),
      hidden: '',
    });

    const items = codes.map((code) => {
      const item = createElement('button', {
        type: 'button',
        class: 'plyr__reactions__item',
        'data-reaction': code,
        'aria-pressed': 'false',
      });
      item.appendChild(createElement('span', { 'aria-hidden': 'true' }, reactionTypes[code]));
      item.appendChild(createElement('span', { class: srOnly }, reactions.getLabel.call(this, code)));
      row.appendChild(item);
      return item;
    });

    wrapper.appendChild(button);
    wrapper.appendChild(row);

    this.elements.reactions = { wrapper, button, current, label, row, items };

    // Restore the stored reaction, without firing an event
    reactions.update.call(this, reactions.getStored.call(this));

    reactions.bind.call(this);

    return wrapper;
  },

  getLabel(code) {
    return i18n.get(`reactionLabels.${code}`, this.config) || code;
  },

  // Show the current reaction on the button and on the items
  update(code) {
    const { wrapper, current, label, items } = this.elements.reactions;
    const name = code ? reactions.getLabel.call(this, code) : '';

    this.reactions.current = code;

    current.textContent = code ? reactionTypes[code] : '';
    toggleHidden(current, !code);
    toggleClass(wrapper, 'plyr__reactions--selected', Boolean(code));
    label.textContent = code
      ? replaceAll(i18n.get('reactCurrent', this.config), '{reaction}', name)
      : i18n.get('react', this.config);

    items.forEach((item) => {
      item.setAttribute('aria-pressed', item.getAttribute('data-reaction') === code ? 'true' : 'false');
    });
  },

  isOpen() {
    const { reactions: elements } = this.elements;
    return Boolean(elements) && !elements.row.hidden;
  },

  // Show or hide the reaction row
  toggleRow(input, focusButton = false) {
    const { reactions: elements } = this.elements;

    if (!elements) {
      return;
    }

    const show = is.boolean(input) ? input : !reactions.isOpen.call(this);

    if (show === reactions.isOpen.call(this)) {
      return;
    }

    toggleHidden(elements.row, !show);
    elements.button.setAttribute('aria-expanded', show ? 'true' : 'false');
    toggleClass(this.elements.container, 'plyr--reactions-open', show);

    if (show) {
      reactions.position.call(this);

      // Focus the current reaction, or the first one
      const index = Math.max(0, codes.indexOf(this.reactions.current));
      setFocus.call(this, elements.items[index], true);
    } else if (focusButton) {
      setFocus.call(this, elements.button, true);
    }
  },

  // Keep the bubble inside the player: limit its width and shift it sideways if needed
  position() {
    const { row } = this.elements.reactions;
    const bounds = this.elements.container.getBoundingClientRect();
    const margin = 8;

    row.style.removeProperty('--plyr-reactions-shift');

    if (!bounds.width) {
      return;
    }

    row.style.maxWidth = `${bounds.width - margin * 2}px`;

    const rect = row.getBoundingClientRect();
    let shift = 0;

    if (rect.left < bounds.left + margin) {
      shift = bounds.left + margin - rect.left;
    } else if (rect.right > bounds.right - margin) {
      shift = bounds.right - margin - rect.right;
    }

    if (shift) {
      row.style.setProperty('--plyr-reactions-shift', `${shift}px`);
    }
  },

  // Pick a reaction: a new one sets or switches it, the same one again removes it
  select(code) {
    if (!this.reactions || !codes.includes(code)) {
      return;
    }

    const next = this.reactions.current === code ? null : code;

    reactions.setStored.call(this, next);
    reactions.update.call(this, next);
    reactions.toggleRow.call(this, false, true);

    const { channel, brand } = this.config.reactions;

    triggerEvent.call(this, this.media, 'reaction', false, {
      video_id: this.reactions.videoId,
      reaction: next || 'removed',
      channel,
      brand,
    });
  },

  // Item clicks, keyboard navigation in the row, and closing on an outside click
  bind() {
    const { wrapper, row, items } = this.elements.reactions;

    items.forEach((item) => {
      on.call(this, item, 'click', () => reactions.select.call(this, item.getAttribute('data-reaction')));
    });

    on.call(
      this,
      row,
      'keydown',
      (event) => {
        const index = items.indexOf(document.activeElement);
        let target = null;

        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            target = items[(index - 1 + items.length) % items.length];
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            target = items[(index + 1) % items.length];
            break;
          case 'Home':
            [target] = items;
            break;
          case 'End':
            target = items[items.length - 1];
            break;
          case 'Escape':
            reactions.toggleRow.call(this, false, true);
            break;
          default:
            return;
        }

        // Keep these keys away from Plyr's shortcuts (seek, volume)
        event.preventDefault();
        event.stopPropagation();

        if (target) {
          setFocus.call(this, target, true);
        }
      },
      false,
    );

    // Escape on the React button closes the row too
    on.call(
      this,
      this.elements.reactions.button,
      'keydown',
      (event) => {
        if (event.key === 'Escape' && reactions.isOpen.call(this)) {
          event.preventDefault();
          event.stopPropagation();
          reactions.toggleRow.call(this, false, true);
        }
      },
      false,
    );

    // A click outside closes the row
    on.call(this, document.body, 'click', (event) => {
      if (reactions.isOpen.call(this) && !wrapper.contains(event.target)) {
        reactions.toggleRow.call(this, false);
      }
    });
  },
};

export default reactions;
