// Einordnung in die Chomsky-Hierarchie (5.25): „Sprache liegt mindestens hier“.
import { egrepHasBackref, parseEgrep } from '../model/egrep';
import { grammarType } from '../model/grammar';
import type { FormalObject, HierarchyPlacement } from '../model/types';

export function hierarchyPlacement(obj: FormalObject): HierarchyPlacement {
  switch (obj.kind) {
    case 'dea':
    case 'nea':
    case 'regex':
    case 'menge':
      return { level: 3, reason: obj.kind, exact: true };
    case 'egrep': {
      const ast = parseEgrep(obj.pattern).ast;
      if (ast && egrepHasBackref(ast)) return { level: 1, reason: 'egrepBackref', exact: false };
      return { level: 3, reason: 'egrep', exact: true };
    }
    case 'grammatik': {
      const info = grammarType(obj);
      if (info.type === 3) return { level: 3, reason: 'grammar3', exact: true };
      if (info.type === 2) return { level: 2, reason: 'grammar2', exact: false };
      if (info.type === 1) return { level: 1, reason: 'grammar1', exact: false };
      // Typ 0 in der Form von 5.1, aber nicht verkürzend: dieselbe Sprachklasse wie Typ 1
      if (info.nonContracting) return { level: 1, reason: 'grammar1', exact: false };
      return { level: 0, reason: 'grammar0', exact: false };
    }
    case 'nka':
      return { level: 2, reason: 'nka', exact: false };
    case 'tm':
      return obj.bounded === true ? { level: 1, reason: 'lba', exact: false } : { level: 0, reason: 'tm', exact: false };
    default:
      return { level: null, reason: 'transducer', exact: false };
  }
}
