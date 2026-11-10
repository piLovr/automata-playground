// Beispielobjekte nach den Nummern im Skript (nur die mathematischen Objekte).

export interface Example {
  id: string;
  ref: string;
  title: string;
  text: string;
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
];
