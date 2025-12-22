/**
 * Main App component for F1 Race Replay
 */
import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useReplayStore, useSelectedDriver, useSectorColors } from "./store/replayStore";
import { useReplayWebSocket } from "./hooks/useReplayWebSocket";
import { usePlaybackAnimation } from "./hooks/usePlaybackAnimation";
import { LightsBoard, LightsBoardHandle } from "./components/LightsBoard";
import { TrackVisualization3D } from "./components/TrackVisualization3D";
import { PlaybackControls } from "./components/PlaybackControls";
import { Leaderboard } from "./components/Leaderboard";
import { FP1Dashboard } from "./components/FP1Dashboard";
import { QualiDashboard } from "./components/QualiDashboard";
import { TelemetryChart } from "./components/TelemetryChart";
import { SidebarMenu } from "./components/SidebarMenu";
import { LoadingModal } from "./components/LoadingModal";
import { LandingPage } from "./components/LandingPage";
import { ComparisonPage } from "./components/ComparisonPage";
import { VerticalNavMenu } from "./components/VerticalNavMenu";
import { motion } from "framer-motion";
import { dataService } from "./services/dataService";
import { preloadDriverImages, preloadTeamLogos, preloadTyreIcons, preloadCommonImages } from "./utils/imagePreloader";
import { getDriverCountryFlagEmoji } from "./utils/countryFlags";


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

const DriverImage = ({ year, code, ext }: { year: number; code: string; ext: string }) => {
  const [imageError, setImageError] = useState(false);
  const [tryingFallback, setTryingFallback] = useState(false);

  const handleError = () => {
    if (!tryingFallback && ext !== 'png') {
      setTryingFallback(true);
    } else {
      setImageError(true);
    }
  };

  const imageSrc = imageError
    ? '/images/drivers/PLACEHOLDER.png'
    : `/images/drivers/${year}/${code.toUpperCase()}.${tryingFallback ? 'png' : ext}`;

  return (
    <img
      src={imageSrc}
      alt={code}
      onError={handleError}
      className="w-full h-full"
    />
  );
};

const DriverNumberImage = ({ year, number, ext }: { year: number; number: string; ext: string }) => {
  const [imageError, setImageError] = useState(false);
  const [tryingFallback, setTryingFallback] = useState(false);

  const handleError = () => {
    if (!tryingFallback && ext !== 'png') {
      setTryingFallback(true);
    } else {
      setImageError(true);
    }
  };

  const imageSrc = imageError
    ? '/images/numbers/PLACEHOLDER.png'
    : `/images/numbers/${year}/${number}.${tryingFallback ? 'png' : ext}`;

  return (
    <img
      src={imageSrc}
      alt={`Driver ${number}`}
      onError={handleError}
      className="h-[60px] w-full max-w-[200px] mt-3 block object-contain object-left"
    />
  );
};

const DriverHero = ({ year }: { year?: number }) => {
  const selected = useSelectedDriver();

  if (!selected) return (
    <div className="flex items-center justify-center min-h-[256px] border border-f1-border bg-f1-dark-gray rounded-xl text-center p-6 mb-3 flex-shrink-0">
      <p className="f1-monospace text-f1-silver text-sm font-semibold tracking-wide">NO DRIVER SELECTED</p>
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
  const nameParts = fullName.split(' ');
  const lastName = nameParts[nameParts.length - 1] || code;
  const firstName = nameParts.slice(0, -1).join(' ') || code;
  const countryFlag = driver?.Country ? getDriverCountryFlagEmoji(driver.Country) : '';
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
        <p className="f1-first-name">{firstName}</p>
        <p className="f1-last-name">{lastName}</p>
        <div className="f1-team-name">{code} {countryFlag}</div>

        {/* Number Image */}
        <DriverNumberImage year={displayYear} number={driverNum} ext={numberImgExt} />
      </div>

      {/* 3. PHOTO CONTENT (Z-INDEX 5) */}
      <div className="f1-card-photo-wrapper">
        <div className="f1-card-photo-inner">
          <DriverImage year={displayYear} code={code} ext={driverImgExt} />
        </div>
      </div>
    </motion.div>
  );
};

const ReplayView = ({ onSessionSelect, onRefreshData }: { onSessionSelect: (year: number, round: number, refresh?: boolean) => void; onRefreshData: () => void }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasPlayedLights, setHasPlayedLights] = useState(false);
  const lightsBoardRef = useRef<LightsBoardHandle>(null);
  const { session, setTotalFrames, play } = useReplayStore();
  const { isConnected } = useReplayWebSocket(session.sessionId);
  const { isEnabled: showSectorColors, toggle: toggleSectorColors } = useSectorColors();

  // Animate playback - advances frameIndex during playback
  usePlaybackAnimation();

  const handlePlayWithLights = () => {
    console.log('handlePlayWithLights called, hasPlayedLights:', hasPlayedLights, 'ref:', lightsBoardRef.current);
    // Only show lights board if this is the first play (not a resume)
    if (!hasPlayedLights) {
      console.log('Showing lights board');
      setHasPlayedLights(true);
      // Don't call play() yet - wait for lights sequence to complete
      lightsBoardRef.current?.startSequence();
    } else {
      console.log('Skipping lights board, already played');
      // Just resume playback without lights
      play();
    }
  };

  const handleLightsSequenceComplete = () => {
    // Now start playback after lights complete
    play();
  };

  // Update total frames when session metadata changes and reset lights flag on new session
  useEffect(() => {
    if (session.metadata?.total_frames) {
      setTotalFrames(session.metadata.total_frames);
    }
    // Reset lights played flag when new session is loaded
    setHasPlayedLights(false);
  }, [session.metadata?.total_frames, session.sessionId, setTotalFrames]);

  const year = session.metadata?.year;
  const round = session.metadata?.round;
  const raceName = year && round
    ? `${year} ${dataService.getRaceName(year, round).toUpperCase()}`
    : 'F1 RACE REPLAY';
  const trackName = year && round ? dataService.getTrackName(year, round) : '';
  const location = year && round ? dataService.getLocation(year, round) : '';

  return (
    <div className="flex h-screen overflow-hidden">
      <LightsBoard ref={lightsBoardRef} onSequenceComplete={handleLightsSequenceComplete} />
      <VerticalNavMenu />
      <div className="app-container">
        <header className="app-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(true)}
              className="bg-f1-red hover:bg-[#c70000] text-white px-3 py-1.5 rounded text-lg border-none cursor-pointer transition-all duration-200 hover:shadow-lg"
              title="Menu"
              onMouseEnter={(e) => {
                (e.currentTarget as any).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as any).style.boxShadow = 'none';
              }}
            >
              ☰
            </button>
            <div className="bg-f1-red text-white px-3 py-1 font-black text-xs">REPLAY</div>
            <div>
              <h1 className="text-base font-bold tracking-wide m-0">{raceName}</h1>
              {trackName && (
                <p className="text-xs text-f1-silver m-0 mt-1 font-mono">
                  {trackName}
                </p>
              )}
            </div>
          </div>
          <div className="flex-1"></div>
          <div className="text-right flex flex-col gap-2">
            {location && (
              <div className="f1-monospace text-xs text-f1-silver">
                {location}
              </div>
            )}
            <div className="f1-monospace text-xs text-f1-silver">
              STATUS: <span className={isConnected ? 'text-green-500' : 'text-red-500'}>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </header>

        <aside className="sidebar-scroll">
          {year && round && (session.metadata?.session_type === 'FP1' || session.metadata?.session_type === 'FP2' || session.metadata?.session_type === 'FP3') ? (
            <FP1Dashboard />
          ) : year && round && (session.metadata?.session_type === 'Q' || session.metadata?.session_type === 'SQ') ? (
            <QualiDashboard />
          ) : (
            <Leaderboard />
          )}
        </aside>

        <main className="relative bg-f1-carbon border border-f1-border rounded-lg overflow-hidden flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            <TrackVisualization3D />
          </div>
          <div className="border-t border-f1-border">
            <PlaybackControls onPlayWithLights={handlePlayWithLights} />
          </div>
        </main>

        <aside className="flex flex-col overflow-hidden h-full max-w-[300px]">
          <DriverHero year={year} />
          <div className="sidebar-scroll bg-f1-black p-4 rounded-lg border border-f1-border flex-1">
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

      </div>
    </div>
  );
};

function AppRoutes() {
  const navigate = useNavigate();
  const { session, setSession, setSessionLoading, pause } = useReplayStore();

  useEffect(() => {
    const handleSessionTypeChangeEvent = (event: any) => {
      const { sessionType, year, round } = event.detail;
      handleSessionTypeChange(year, round, sessionType);
    };

    window.addEventListener('sessionTypeChange', handleSessionTypeChangeEvent);
    return () => window.removeEventListener('sessionTypeChange', handleSessionTypeChangeEvent);
  }, []);

  const handleSessionSelect = async (year: number, round: number, refresh: boolean = false) => {
    try {
      if (session.sessionId) {
        pause();
      }

      // CRITICAL: Reset loading state BEFORE opening modal
      const store = useReplayStore.getState();
      store.setLoadingProgress(0);
      store.setLoadingError(null);
      store.setLoadingComplete(false);

      // Preload images in the background while loading the session
      const drivers = dataService.getAllDriversForYear(year);
      const driverCodes = drivers.map(d => d.Code);

      Promise.all([
        preloadDriverImages(driverCodes, year),
        preloadTeamLogos(),
        preloadTyreIcons(),
        preloadCommonImages(),
      ]).catch(err => console.warn("Image preloading failed:", err));

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, round_num: round, session_type: "R", refresh })
      });
      const data = await response.json();

      setSession(data.session_id, {
        year,
        round,
        session_type: "R",
      } as any);
      setSessionLoading(true);  // NOW open modal - WebSocket will close it when done
      navigate("/replay");
    } catch (err) {
      console.error("Failed to load session:", err);
      setSessionLoading(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      await fetch("/api/sessions/cache", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear cache:", err);
    }

    if (session.metadata?.year && session.metadata?.round) {
      handleSessionSelect(session.metadata.year, session.metadata.round, true);
    }
  };

  const handleSessionTypeChange = async (year: number, round: number, sessionType: string) => {
    try {
      if (session.sessionId) {
        pause();
      }

      // CRITICAL: Reset loading state BEFORE opening modal
      const store = useReplayStore.getState();
      store.setLoadingProgress(0);
      store.setLoadingError(null);
      store.setLoadingComplete(false);

      // Preload images in the background while loading the session
      const drivers = dataService.getAllDriversForYear(year);
      const driverCodes = drivers.map(d => d.Code);

      Promise.all([
        preloadDriverImages(driverCodes, year),
        preloadTeamLogos(),
        preloadTyreIcons(),
        preloadCommonImages(),
      ]).catch(err => console.warn("Image preloading failed:", err));

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, round_num: round, session_type: sessionType, refresh: false })
      });
      const data = await response.json();

      setSession(data.session_id, {
        year,
        round,
        session_type: sessionType,
      } as any);
      setSessionLoading(true);  // NOW open modal - WebSocket will close it when done
    } catch (err) {
      console.error("Failed to load session:", err);
      setSessionLoading(false);
    }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onSessionSelect={handleSessionSelect} isLoading={session.isLoading} />} />
      <Route
        path="/replay"
        element={session.sessionId ? <ReplayView onSessionSelect={handleSessionSelect} onRefreshData={handleRefreshData} /> : <Navigate to="/" replace />}
      />
      <Route path="/comparison" element={<ComparisonPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const { session } = useReplayStore();

  return (
    <BrowserRouter>
      <AppRoutes />
      <LoadingModal
        isOpen={session.isLoading}
        sessionId={session.sessionId}
        year={session.metadata?.year}
        round={session.metadata?.round}
      />
    </BrowserRouter>
  );
}

export default App;