// Beispielbibliothek: die mathematischen Objekte aus dem Skript liegen als Textdateien in
// examples/, die Übersicht (Kapitel, Nummer, Titel) in examples/index.json. Beides wird
// beim Bauen eingebettet; eine einzige Quelle für App und Tests.
import index from '../../examples/index.json';

export interface Example {
  id: string;
  /** Nummer im Skript; leer bei eigenen Beispielen (nicht im Skript). */
  ref: string;
  chapter: number;
  title: string;
  text: string;
  /** Vorschlag für das Eingabewort beim Laden. */
  word?: string;
  /** egrep: Prüftext beim Laden. */
  testText?: string;
  /** Hinweis zur Lesart des Skripts. */
  note?: string;
}

interface IndexEntry {
  id: string;
  file: string;
  chapter: number;
  ref: string;
  title: string;
  word?: string;
  testText?: string;
  note?: string;
}

const files = import.meta.glob('../../examples/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const examples: Example[] = (index as IndexEntry[])
  .filter((e) => `../../examples/${e.file}` in files)
  .map(({ file, ...e }) => ({ ...e, text: files[`../../examples/${file}`]! }));
