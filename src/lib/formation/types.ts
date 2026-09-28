export interface Dancer {
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface Formation {
  dancers: Dancer[];
}

export interface FormationSection {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
  formation: Formation;
}
