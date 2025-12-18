export const TEAM_LOGO_MAP: Record<string, string> = {
  alpine: 'alpine_small_white.avif',
  aston_martin: 'astonmartin_small_white.avif',
  ferrari: 'ferrari_small_white.avif',
  haas: 'haasf1team_small_white.avif',
  sauber: 'kicksauber_small_white.avif',
  mclaren: 'mclaren_small_white.avif',
  mercedes: 'mercedes_small_white.avif',
  rb: 'racingbulls_small_white.avif',
  red_bull: 'redbullracing_small_white.avif',
  williams: 'williams_small_white.avif',
};

export const getTeamLogoPath = (teamName?: string): string | null => {
  if (!teamName) return null;
  const logoFile = TEAM_LOGO_MAP[teamName.toLowerCase()];
  return logoFile ? `/images/team-logos/${logoFile}` : null;
};
