export interface Driver {
  First: string;
  Last: string;
  Code: string;
  Country: string;
  Team: string;
  CarNumber: string;
}

export interface RoundData {
  round: number;
  raceName: string;
  track: string;
  location: string;
}

export interface TeamData {
  slug: string;
  name: string;
  primaryColorHex: string;
  seasonBrandColorsHex: string[];
  notes: string;
}

export type DriversData = Record<string, Driver[]>;
export type RoundsData = Record<string, RoundData[]>;
export type TeamsData = Record<string, TeamData[]>;
