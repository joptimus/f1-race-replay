/**
 * Main App component for F1 Race Replay
 */
import { useEffect, useState } from "react";
import { useReplayStore, useSelectedDriver, useCurrentFrame } from "./store/replayStore";
import { useReplayWebSocket } from "./hooks/useReplayWebSocket";
import { TrackVisualization3D } from "./components/TrackVisualization3D";
import { PlaybackControls } from "./components/PlaybackControls";
import { Leaderboard } from "./components/Leaderboard";
import { TelemetryChart } from "./components/TelemetryChart";
import { SidebarMenu } from "./components/SidebarMenu";
import { SessionModal } from "./components/SessionModal";
import { LoadingModal } from "./components/LoadingModal";
import { motion } from "framer-motion";

const DRIVER_NUMBERS: Record<string, string> = {
  "HAM": "44", "VER": "1", "NOR": "4", "PIA": "81", "LEC": "16",
  "SAI": "55", "RUS": "63", "ALO": "14", "STR": "18", "GAS": "10",
  "OCO": "31", "ALB": "23", "TSU": "22", "RIC": "3", "BOT": "77",
  "ZHO": "24", "HUL": "27", "MAG": "20", "SAR": "55", "PER": "30",
  "ANT": "12", "LAW": "30", "COL": "5", "BEA": "87", "BOR": "5", "HAD": "6",
  "DOO": "7", "OCA": "81"
};

const DriverHero = () => {
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
  const driverNum = DRIVER_NUMBERS[code] || "0";

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
        <p className="f1-first-name">{code}</p>
        <p className="f1-last-name">{code}</p>
        <div className="f1-team-name">{code}</div>

        {/* Number Image */}
        <img
          src={`/images/numbers/2025/${driverNum}.avif`}
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
            src={`/images/drivers/2025/${code.toUpperCase()}.avif`}
            alt={code}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      </div>
    </motion.div>
  );
};

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [loadingSessionYear, setLoadingSessionYear] = useState(0);
  const [loadingSessionRound, setLoadingSessionRound] = useState(0);
  const { session, setSession, setSessionLoading, pause } = useReplayStore();
  const currentFrame = useCurrentFrame();
  const { isConnected } = useReplayWebSocket(session.sessionId);

  useEffect(() => {
    const loadDefaultSession = async () => {
      try {
        setSessionLoading(true);
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: 2025, round_num: 12, session_type: "R" })
        });
        const data = await response.json();
        setSession(data.session_id, data.metadata);
        pollSessionStatus(data.session_id);
      } catch (err) { console.error(err); }
    };
    loadDefaultSession();
  }, [setSession, setSessionLoading]);

  // Poll for session status until data is loaded
  const pollSessionStatus = async (sessionId: string) => {
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();

        setSession(data.session_id, data.metadata);

        if (!data.loading) {
          setSessionLoading(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Poll every second
        } else {
          setSessionLoading(false);
        }
      } catch (err) {
        console.error("Failed to poll session status:", err);
        setSessionLoading(false);
      }
    };

    poll();
  };

  const handleSessionSelect = async (year: number, round: number) => {
    try {
      pause(); // Pause playback
      setLoadingSessionYear(year);
      setLoadingSessionRound(round);
      setSessionLoading(true);

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, round_num: round, session_type: "R" })
      });
      const data = await response.json();
      setSession(data.session_id, data.metadata);
      pollSessionStatus(data.session_id);
    } catch (err) {
      console.error("Failed to load session:", err);
      setSessionLoading(false);
    }
  };

  const weather = currentFrame?.weather;
  const year = session.metadata?.year;
  const round = session.metadata?.round;
  const raceName = year && round ? `${year} F1 ROUND ${round}` : 'F1 RACE REPLAY';

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
          <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.05em' }}>{raceName}</h1>
        </div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          {weather && (
            <div className="f1-monospace" style={{ fontSize: '0.75rem', color: 'var(--f1-silver)', display: 'flex', gap: '12px' }}>
              <div style={{ whiteSpace: 'nowrap' }}>T {Math.round(weather.track_temp)}°</div>
              <div style={{ whiteSpace: 'nowrap' }}>W {Math.round(weather.wind_speed)}</div>
              {weather.rain_state !== 'Dry' && <div style={{ whiteSpace: 'nowrap' }}>{weather.rain_state}</div>}
            </div>
          )}
        </div>
        <div className="f1-monospace" style={{ fontSize: '0.8rem', color: 'var(--f1-silver)' }}>
          STATUS: <span style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </header>

      <aside className="sidebar-scroll">
        <Leaderboard />
      </aside>

      <main style={{ position: 'relative', background: 'var(--f1-carbon)', border: '1px solid var(--f1-border)', borderRadius: '8px', overflow: 'hidden' }}>
        <TrackVisualization3D />
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 10 }}>
          <PlaybackControls />
        </div>
      </main>

      <aside className="flex flex-col overflow-hidden h-full">
        <DriverHero />
        <div className="sidebar-scroll" style={{ background: 'var(--f1-black)', padding: '16px', borderRadius: '8px', border: '1px solid var(--f1-border)', flex: 1 }}>
          <TelemetryChart />
        </div>
      </aside>

      <SidebarMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLoadSession={() => setSessionModalOpen(true)}
      />

      <SessionModal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        onSessionSelect={handleSessionSelect}
        currentYear={year}
        currentRound={round}
        isLoading={session.isLoading}
      />

      <LoadingModal
        isOpen={session.isLoading}
        year={loadingSessionYear || year}
        round={loadingSessionRound || round}
        isFullyLoaded={!!session.metadata?.total_frames && !session.isLoading}
      />
    </div>
  );
}

export default App;