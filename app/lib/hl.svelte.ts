// Gemeinsame Hervorhebung (Abschnitt 8.4): ein gezeigtes Element und alle Entsprechungen
// entlang der Herkunftskette, für Einzelansicht und Arbeitsfläche.
import type { ElemRef } from '../../core/index';
import { store } from './store.svelte';
import { elemKey, related } from './corr';

class Highlight {
  hover = $state<{ object: string; elem: ElemRef } | null>(null);

  #map = $derived.by(() => {
    const h = this.hover;
    if (!h) return new Map<string, Set<string>>();
    return related(store.doc, h.object, h.elem);
  });

  set(object: string, elem: ElemRef | null): void {
    if (!elem) {
      if (this.hover?.object === object) this.hover = null;
      return;
    }
    if (this.hover?.object === object && elemKey(this.hover.elem) === elemKey(elem)) return;
    this.hover = { object, elem };
  }

  keysFor(object: string): Set<string> {
    return this.#map.get(object) ?? new Set();
  }
}

export const hl = new Highlight();
