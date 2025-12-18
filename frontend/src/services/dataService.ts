import driversData from '../data/drivers.json';
import roundsData from '../data/round_data.json';
import teamsData from '../data/teams.json';
import type { Driver, RoundData, TeamData, DriversData, RoundsData, TeamsData } from '../types/data';

const typedDriversData = driversData as DriversData;
const typedRoundsData = roundsData as RoundsData;
const typedTeamsData = teamsData as TeamsData;

export const dataService = {
  getDriverByCode(year: number, code: string): Driver | null {
    const yearStr = year.toString();
    const drivers = typedDriversData[yearStr];

    if (!drivers) return null;

    const codeLower = code.toLowerCase();

    const driver = drivers.find(d => {
      return d.Code.toLowerCase() === codeLower || d.CarNumber === code;
    });

    return driver || null;
  },

  getDriverFullName(year: number, code: string): string {
    const driver = this.getDriverByCode(year, code);
    return driver ? `${driver.First} ${driver.Last}` : code;
  },

  getRoundByNumber(year: number, round: number): RoundData | null {
    const yearStr = year.toString();
    const rounds = typedRoundsData[yearStr];

    if (!rounds) return null;

    return rounds.find(r => r.round === round) || null;
  },

  getRaceName(year: number, round: number): string {
    const roundData = this.getRoundByNumber(year, round);
    return roundData ? roundData.raceName : `ROUND ${round}`;
  },

  getTrackName(year: number, round: number): string {
    const roundData = this.getRoundByNumber(year, round);
    return roundData ? roundData.track : '';
  },

  getLocation(year: number, round: number): string {
    const roundData = this.getRoundByNumber(year, round);
    return roundData ? roundData.location : '';
  },

  getAllDriversForYear(year: number): Driver[] {
    const yearStr = year.toString();
    return typedDriversData[yearStr] || [];
  },

  getTeamBySlug(year: number, slug: string): TeamData | null {
    const yearStr = year.toString();
    const teams = typedTeamsData[yearStr];

    if (!teams) return null;

    return teams.find(t => t.slug === slug) || null;
  },

  getAllTeamsForYear(year: number): TeamData[] {
    const yearStr = year.toString();
    return typedTeamsData[yearStr] || [];
  },

  getAvailableYears(): number[] {
    const years = [
      ...new Set([
        ...Object.keys(typedDriversData).map(Number),
        ...Object.keys(typedRoundsData).map(Number),
      ]),
    ].sort((a, b) => b - a);
    return years;
  },
};
