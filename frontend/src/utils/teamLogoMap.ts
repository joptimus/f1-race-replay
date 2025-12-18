export const TEAM_LOGO_MAP: Record<string, string> = {
  alpine: 'alpine_small_white.avif',
  astonmartin: 'astonmartin_small_white.avif',
  ferrari: 'ferrari_small_white.avif',
  haasf1team: 'haasf1team_small_white.avif',
  kicksauber: 'kicksauber_small_white.avif',
  mclaren: 'mclaren_small_white.avif',
  mercedes: 'mercedes_small_white.avif',
  racingbulls: 'racingbulls_small_white.avif',
  redbullracing: 'redbullracing_small_white.avif',
  williams: 'williams_small_white.avif',
};

export const getTeamLogoPath = (teamName?: string): string | null => {
  if (!teamName) return null;
  const logoFile = TEAM_LOGO_MAP[teamName.toLowerCase()];
  return logoFile ? `/images/team-logos/${logoFile}` : null;
};
