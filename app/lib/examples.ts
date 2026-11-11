// Beispielobjekte nach den Nummern im Skript (nur die mathematischen Objekte).

export interface Example {
  id: string;
  /** Nummer im Skript; leer bei eigenen Beispielen (nicht im Skript). */
  ref: string;
  title: string;
  text: string;
  /** Vorschlag für das Eingabewort beim Laden. */
  word?: string;
  /** egrep: Prüftext beim Laden. */
  testText?: string;
}

export const examples: Example[] = [
  {
    id: 'b2-3',
    ref: '2.3',
    title: 'Dualzahlen mit Vorzeichen',
    text: `dea Dualzahl {
  alphabet 0 1 \\-
  start A
  accept B
  A -0,1-> B
  A -\\--> M
  M -0,1-> B
  M -\\--> Q
  B -0,1-> B
  B -\\--> Q
  Q -0,1,\\--> Q
  layout A@0,0 B@240,-80 M@240,90 Q@480,10
}
`,
  },
  {
    id: 'b2-14',
    ref: '2.14',
    title: 'DEA mit drei Zuständen',
    text: `dea B2_14 {
  alphabet 0 1
  start A
  accept A B
  A -0-> A
  A -1-> B
  B -1-> B
  B -0-> C
  C -0,1-> C
  layout A@0,0 B@200,0 C@400,0
}
`,
  },
  {
    id: 'b2-15',
    ref: '2.15',
    title: 'DEA mit Fangzustand',
    text: `dea B2_15 {
  alphabet 0 1
  start 0
  accept 0 1 2
  0 -0-> 1
  1 -0-> 2
  2 -0-> 2
  2 -1-> 0
  0 -1-> Q
  1 -1-> Q
  Q -0,1-> Q
  layout 0@0,0 1@200,0 2@400,0 Q@200,160
}
`,
  },
  {
    id: 'b2-61',
    ref: '2.61',
    title: 'NEA ohne Fangzustand',
    text: `nea N2_61 {
  alphabet 0 1
  start 0
  accept 0 1 2
  0 -0-> 1
  1 -0-> 2
  2 -0-> 2
  2 -1-> 0
  layout 0@0,0 1@200,0 2@400,0
}
`,
  },
  {
    id: 'b2-66',
    ref: '2.66',
    title: 'NEA mit Wort- und ε-Übergängen',
    text: `nea N2_66 {
  alphabet 0 1
  states 0 1 2 3 4 5
  start 0
  accept 2 5
  0 -ε-> 2
  0 -ε-> 5
  2 -01-> 2
  5 -001-> 5
  layout 0@0,0 1@420,-90 2@200,-90 3@420,0 4@420,90 5@200,90
}
`,
  },
  {
    id: 'b2-24',
    ref: '2.24',
    title: 'Ausdruck (0*1*)*',
    word: '0110',
    text: `regex B2_24 = (0*1*)*
`,
  },
  {
    id: 'ra-endet01',
    ref: '',
    title: 'Ausdruck: endet auf 01 (Abnahme M2)',
    word: '1101',
    text: `regex Endet01 = (0|1)*01
`,
  },
  {
    id: 'b2-44',
    ref: '2.44',
    title: 'Typ-3-Grammatik für Gleitkommazahlen',
    word: '-10.1E-1',
    text: `grammatik B2_44 {
  nichtterminale X0 X1 X2 X3 X4 X5 X6 X7
  terminale 0 1 - . E
  start X0
  X0 -> -X1 | X1
  X1 -> 0X2 | 1X2
  X2 -> 0X2 | 1X2 | ε | X3
  X3 -> .0X4 | .1X4 | X5
  X4 -> 0X4 | 1X4 | ε | X5
  X5 -> E-X6 | EX6
  X6 -> 0X7 | 1X7
  X7 -> 0X7 | 1X7 | ε
}
`,
  },
  {
    id: 'b2-66-ra',
    ref: '2.66',
    title: 'Ausdruck (01)*|(001)*',
    word: '0101',
    text: `regex B2_66 = (01)*|(001)*
`,
  },
  {
    id: 'b2-92',
    ref: '2.92',
    title: 'DEA zum Minimieren',
    word: 'ab',
    text: `dea B2_92 {
  alphabet a b
  start A
  accept C D G
  A -a-> B
  A -b-> F
  B -a-> C
  B -b-> E
  C -a,b-> D
  D -a-> C
  D -b-> D
  E -a,b-> E
  F -a-> E
  F -b-> G
  G -a-> G
  G -b-> C
  layout A@0,0 B@180,-110 F@180,110 C@380,-110 E@380,40 G@380,170 D@580,-110
}
`,
  },
  {
    id: 'b3-23',
    ref: '3.23',
    title: 'Regex mit zwei Gruppen',
    testText: 'zzbbcbbz\nzzbbcbbzzzbbcccbb\nzzbbz',
    text: `egrep B3_23 = (bb)c*(bb)
`,
  },
  {
    id: 'b3-24',
    ref: '3.24',
    title: 'Regex (.*)(.*): erste Gruppe ist gefräßig',
    testText: 'abcdefg',
    text: `egrep B3_24 = (.*)(.*)
`,
  },
  {
    id: 'b2-10',
    ref: '2.10',
    title: 'Moore-Automat: Ausgabe 1 bei Dualzahl',
    word: '-101',
    text: `moore Dualzahl_g {
  alphabet 0 1 \\-
  ausgabealphabet 0 1
  start A
  out A=0 B=1 M=0 Q=0
  A -0,1-> B
  A -\\--> M
  M -0,1-> B
  M -\\--> Q
  B -0,1-> B
  B -\\--> Q
  Q -0,1,\\--> Q
  layout A@0,0 B@240,-80 M@240,90 Q@480,10
}
`,
  },
  {
    id: 'mealy-paritaet',
    ref: '',
    title: 'Mealy-Automat: laufende Parität (nicht im Skript)',
    word: '1101',
    text: `mealy Paritaet {
  alphabet 0 1
  ausgabealphabet 0 1
  start g
  g -0/0-> g
  g -1/1-> u
  u -0/1-> u
  u -1/0-> g
  layout g@0,0 u@240,0
}
`,
  },
  {
    id: 'b4-6',
    ref: '4.6',
    title: 'Kellerautomat für 0ᵏ1ᵏ',
    word: '00001111',
    text: `nka NullEins {
  alphabet 0 1
  keller *
  states z0 z1 z+ z−
  start z0
  accept z+
  z0, *, 0 -> z0, 0*
  z0, 0, 0 -> z0, 00
  z0, 0, 1 -> z1, ε
  z1, 0, 1 -> z1, ε
  z1, *, ε -> z+, *
  layout z0@0,0 z1@240,0 z+@480,0 z−@240,160
}
`,
  },
  {
    id: 'b4-9',
    ref: '4.9',
    title: 'Kellerautomat für Palindrome gerader Länge',
    word: 'abaaaaba',
    text: `nka Palindrom {
  alphabet a b
  keller *
  states zin zout z+ z−
  start zin
  accept z+
  zin, *, a -> zin, a*
  zin, *, b -> zin, b*
  zin, a, a -> zin, aa
  zin, a, b -> zin, ba
  zin, b, a -> zin, ab
  zin, b, b -> zin, bb
  zin, a, ε -> zout, a
  zin, b, ε -> zout, b
  zout, a, a -> zout, ε
  zout, a, b -> z−, ε
  zout, b, a -> z−, ε
  zout, b, b -> zout, ε
  zout, *, ε -> z+, *
  layout zin@0,0 zout@280,0 z+@560,0 z−@280,190
}
`,
  },
  {
    id: 'b5-9',
    ref: '5.9',
    title: 'Turingmaschine für Palindrome',
    word: 'abbba',
    text: `tm Palindrom_TM {
  alphabet a b
  blank □
  states r ra rb la lb l f+ f-
  start r
  accept f+
  reject f-
  r, a -> ra, □, R
  r, b -> rb, □, R
  r, □ -> f+, □, N
  ra, a -> ra, a, R
  ra, b -> ra, b, R
  ra, □ -> la, □, L
  rb, a -> rb, a, R
  rb, b -> rb, b, R
  rb, □ -> lb, □, L
  la, a -> l, □, L
  la, b -> f-, b, N
  la, □ -> f+, □, N
  lb, a -> f-, a, N
  lb, b -> l, □, L
  lb, □ -> f+, □, N
  l, a -> l, a, L
  l, b -> l, b, L
  l, □ -> r, □, R
  layout r@0,0 ra@240,-130 la@480,-130 rb@240,150 lb@480,150 l@360,10 f+@-140,-250 f-@720,10
}
`,
  },
  {
    id: 'tm-inc',
    ref: '',
    title: 'Turingmaschine: Binärzahl + 1 (nicht im Skript)',
    word: '1011',
    text: `tm PlusEins {
  alphabet 0 1
  blank □
  start r
  accept f+
  r, 0 -> r, 0, R
  r, 1 -> r, 1, R
  r, □ -> c, □, L
  c, 1 -> c, 0, L
  c, 0 -> f+, 1, N
  c, □ -> f+, 1, N
  layout r@0,0 c@240,0 f+@480,0
}
`,
  },
];
