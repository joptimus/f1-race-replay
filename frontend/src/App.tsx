/**
 * Main App component for F1 Race Replay
 */
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useReplayStore, useSelectedDriver, useCurrentFrame, useSectorColors } from "./store/replayStore";
import { useReplayWebSocket } from "./hooks/useReplayWebSocket";
import { TrackVisualization3D } from "./components/TrackVisualization3D";
import { PlaybackControls } from "./components/PlaybackControls";
import { Leaderboard } from "./components/Leaderboard";
import { TelemetryChart } from "./components/TelemetryChart";
import { SidebarMenu } from "./components/SidebarMenu";
import { LoadingModal } from "./components/LoadingModal";
import { LandingPage } from "./components/LandingPage";
import { ComparisonPage } from "./components/ComparisonPage";
import { motion } from "framer-motion";
import { dataService } from "./services/dataService";


const getImageExtension = (year: number, imageType: 'driver' | 'number' = 'driver'): string => {
  if (imageType === 'number') {
    if (year >= 2025) return "avif";
    if (year >= 2022) return "png";
    return "png";
  }

  if (year >= 2025) return "avif";
  if (year >= 2022) return "png";
  return "jpg";
};

const DriverHero = ({ year }: { year?: number }) => {
  const selected = useSelectedDriver();

  if (!selected) return (
    <div className="f1-driver-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="f1-monospace">SELECT A DRIVER</p>
    </div>
  );

  const { code, color } = selected;
  const teamColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

  // Calculate accessible color (darker version)
  const accessibleColor = `rgb(${Math.max(0, color[0] - 80)}, ${Math.max(0, color[1] - 80)}, ${Math.max(0, color[2] - 80)})`;
  const displayYear = year || 2025;
  const driver = year ? dataService.getDriverByCode(year, code) : null;
  const driverNum = driver?.CarNumber || "0";
  const fullName = year ? dataService.getDriverFullName(year, code) : code;
  const driverImgExt = getImageExtension(displayYear, 'driver');
  const numberImgExt = getImageExtension(displayYear, 'number');

  return (
    <motion.div
      key={code}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="f1-driver-card"
      style={{
        '--f1-team-colour': teamColor,
        '--f1-accessible-colour': accessibleColor
      } as any}
    >
      {/* 1. BACKGROUND LAYERS (Z-INDEX 1 & 2) */}
      <div className="f1-card-pattern-container">
        <div className="f1-card-pattern" />
      </div>
      <div className="f1-card-gradient" />

      {/* 2. TEXT CONTENT (Z-INDEX 10) */}
      <div className="f1-card-info">
        <p className="f1-first-name">{fullName.split(' ')[0] || code}</p>
        <p className="f1-last-name">{fullName.split(' ')[1] || code}</p>
        <div className="f1-team-name">{code}</div>

        {/* Number Image */}
        <img
          src={`/images/numbers/${displayYear}/${driverNum}.${numberImgExt}`}
          alt={`Driver ${driverNum}`}
          style={{
            height: '60px',
            width: '100%',
            maxWidth: '200px',
            marginTop: '12px',
            display: 'block',
            objectFit: 'contain',
            objectPosition: 'left'
          }}
          onError={(e) => console.error('Image load error:', e.currentTarget.src)}
        />
      </div>

      {/* 3. PHOTO CONTENT (Z-INDEX 5) */}
      <div className="f1-card-photo-wrapper">
        <div className="f1-card-photo-inner">
          <img
            src={`/images/drivers/${displayYear}/${code.toUpperCase()}.${driverImgExt}`}
            alt={code}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      </div>
    </motion.div>
  );
};

const ReplayView = ({ onSessionSelect, onRefreshData }: { onSessionSelect: (year: number, round: number, refresh?: boolean) => void; onRefreshData: () => void }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, setTotalFrames } = useReplayStore();
  const currentFrame = useCurrentFrame();
  const { isConnected } = useReplayWebSocket(session.sessionId);
  const { isEnabled: showSectorColors, toggle: toggleSectorColors } = useSectorColors();

  // Update total frames when session metadata changes
  useEffect(() => {
    if (session.metadata?.total_frames) {
      setTotalFrames(session.metadata.total_frames);
    }
  }, [session.metadata?.total_frames, setTotalFrames]);

  const weather = currentFrame?.weather;
  const year = session.metadata?.year;
  const round = session.metadata?.round;
  const raceName = year && round
    ? `${year} ${dataService.getRaceName(year, round).toUpperCase()}`
    : 'F1 RACE REPLAY';
  const trackName = year && round ? dataService.getTrackName(year, round) : '';
  const location = year && round ? dataService.getLocation(year, round) : '';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center" style={{ gap: '16px' }}>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: 'var(--f1-red)',
              border: 'none',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: 'white',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            title="Menu"
            onMouseEnter={(e) => {
              (e.currentTarget as any).style.background = '#c70000';
              (e.currentTarget as any).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as any).style.background = 'var(--f1-red)';
              (e.currentTarget as any).style.boxShadow = 'none';
            }}
          >
            ☰
          </button>
          <div style={{ background: 'var(--f1-red)', padding: '4px 12px', fontWeight: 900, fontSize: '0.75rem' }}>REPLAY</div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0 }}>{raceName}</h1>
            {trackName && (
              <p style={{ fontSize: '0.75rem', color: 'var(--f1-silver)', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                {trackName}
              </p>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {location && (
            <div className="f1-monospace" style={{ fontSize: '0.8rem', color: 'var(--f1-silver)' }}>
              {location}
            </div>
          )}
          {weather && (
            <div className="f1-monospace" style={{ fontSize: '0.75rem', color: 'var(--f1-silver)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <div style={{ whiteSpace: 'nowrap' }}>T {Math.round(weather.track_temp)}°</div>
              <div style={{ whiteSpace: 'nowrap' }}>W {Math.round(weather.wind_speed)}</div>
              {weather.rain_state !== 'Dry' && <div style={{ whiteSpace: 'nowrap' }}>{weather.rain_state}</div>}
            </div>
          )}
          <div className="f1-monospace" style={{ fontSize: '0.8rem', color: 'var(--f1-silver)' }}>
            STATUS: <span style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </header>

      <aside className="sidebar-scroll">
        <Leaderboard />
      </aside>

      <main style={{ position: 'relative', background: 'var(--f1-carbon)', border: '1px solid var(--f1-border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <TrackVisualization3D />
        </div>
        <div style={{ borderTop: '1px solid var(--f1-border)' }}>
          <PlaybackControls />
        </div>
      </main>

      <aside className="flex flex-col overflow-hidden h-full">
        <DriverHero year={year} />
        <div className="sidebar-scroll" style={{ background: 'var(--f1-black)', padding: '16px', borderRadius: '8px', border: '1px solid var(--f1-border)', flex: 1 }}>
          <TelemetryChart />
        </div>
      </aside>

      <SidebarMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentYear={year}
        currentRound={round}
        onSessionSelect={onSessionSelect}
        onRefreshData={onRefreshData}
        showSectorColors={showSectorColors}
        onToggleSectorColors={toggleSectorColors}
      />

      <LoadingModal
        isOpen={session.isLoading}
        year={year}
        round={round}
        isFullyLoaded={!!session.metadata?.total_frames && !session.isLoading}
      />
    </div>
  );
};

function AppRoutes() {
  const navigate = useNavigate();
  const { session, setSession, setSessionLoading, pause } = useReplayStore();

  const pollSessionStatus = async (sessionId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();

        setSession(data.session_id, data.metadata);

        if (!data.loading) {
          setSessionLoading(false);
          navigate("/replay");
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setSessionLoading(false);
          navigate("/replay");
        }
      } catch (err) {
        console.error("Failed to poll session status:", err);
        setSessionLoading(false);
      }
    };

    poll();
  };

  const handleSessionSelect = async (year: number, round: number, refresh: boolean = false) => {
    try {
      if (session.sessionId) {
        pause();
      }
      setSessionLoading(true);

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, round_num: round, session_type: "R", refresh })
      });
      const data = await response.json();
      setSession(data.session_id, data.metadata);
      setSessionLoading(true);
      pollSessionStatus(data.session_id);
    } catch (err) {
      console.error("Failed to load session:", err);
      setSessionLoading(false);
    }
  };

  const handleRefreshData = async () => {
    if (session.metadata?.year && session.metadata?.round) {
      handleSessionSelect(session.metadata.year, session.metadata.round, true);
    }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onSessionSelect={handleSessionSelect} isLoading={session.isLoading} />} />
      <Route path="/replay" element={<ReplayView onSessionSelect={handleSessionSelect} onRefreshData={handleRefreshData} />} />
      <Route path="/comparison" element={<ComparisonPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;