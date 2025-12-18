import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Gauge, BarChart3, Home, Flag, Zap, Trophy } from "lucide-react";
import { useReplayStore } from "../store/replayStore";

export const VerticalNavMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useReplayStore((state) => state.session);

  const navItems = [
    {
      icon: Home,
      label: "Home",
      path: "/",
      tooltip: "Home",
      always: true
    },
    {
      icon: Gauge,
      label: "Replay",
      path: "/replay",
      tooltip: "Race Replay",
      always: true
    },
    {
      icon: BarChart3,
      label: "Telemetry",
      path: "/comparison",
      tooltip: "Telemetry Analysis",
      always: true
    }
  ];

  const sessionButtons = [
    {
      icon: Flag,
      label: "FP1",
      sessionType: "FP1",
      tooltip: "Free Practice 1"
    },
    {
      icon: Flag,
      label: "FP2",
      sessionType: "FP2",
      tooltip: "Free Practice 2"
    },
    {
      icon: Flag,
      label: "FP3",
      sessionType: "FP3",
      tooltip: "Free Practice 3"
    },
    {
      icon: Zap,
      label: "QUALI",
      sessionType: "Q",
      tooltip: "Qualifying"
    },
    {
      icon: Trophy,
      label: "SPRINT",
      sessionType: "S",
      tooltip: "Sprint Race"
    },
    {
      icon: Trophy,
      label: "RACE",
      sessionType: "R",
      tooltip: "Grand Prix"
    }
  ];

  const isActive = (path: string) => location.pathname === path;
  const currentSessionType = session.metadata?.session_type;

  const getAvailableSessions = (): typeof sessionButtons => {
    // For now, show all session types that we can load
    // In a real implementation, this would come from the API
    return sessionButtons;
  };


  const availableSessions = getAvailableSessions();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        background: 'var(--f1-black)',
        borderRight: '1px solid var(--f1-border)',
        height: '100%',
        alignItems: 'center',
        overflowY: 'auto'
      }}
    >
      {/* Navigation Items */}
      {navItems.map(({ icon: Icon, path, tooltip }) => {
        const active = isActive(path);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            title={tooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              border: active ? '2px solid var(--f1-red)' : '1px solid var(--f1-border)',
              background: active ? 'rgba(225, 6, 0, 0.1)' : 'var(--f1-dark-gray)',
              color: active ? '#e10600' : '#9ca3af',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: 0
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!active) {
                el.style.borderColor = '#e10600';
                el.style.color = '#e10600';
                el.style.background = 'rgba(225, 6, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!active) {
                el.style.borderColor = 'var(--f1-border)';
                el.style.color = '#9ca3af';
                el.style.background = 'var(--f1-dark-gray)';
              }
            }}
          >
            <Icon size={24} />
          </button>
        );
      })}

      {/* Separator */}
      {availableSessions.length > 0 && (
        <div
          style={{
            width: '30px',
            height: '1px',
            background: 'rgba(255, 255, 255, 0.1)',
            margin: '4px 0'
          }}
        />
      )}

      {/* Session Type Buttons */}
      {availableSessions.map(({ label, sessionType, tooltip }) => {
        const isActive = currentSessionType === sessionType;
        return (
          <button
            key={sessionType}
            onClick={() => {
              if (session.metadata?.year && session.metadata?.round) {
                // Trigger session type change by calling the handler
                // This will be handled through the parent component
                window.dispatchEvent(new CustomEvent('sessionTypeChange', {
                  detail: { sessionType, year: session.metadata.year, round: session.metadata.round }
                }));
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '40px',
              borderRadius: '6px',
              border: isActive ? '2px solid var(--f1-red)' : '1px solid var(--f1-border)',
              background: isActive ? 'rgba(225, 6, 0, 0.1)' : 'var(--f1-dark-gray)',
              color: isActive ? '#e10600' : '#9ca3af',
              fontSize: '9px',
              fontWeight: 900,
              cursor: isActive ? 'default' : 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              padding: 0,
              transition: 'all 0.2s ease',
              opacity: session.metadata ? 1 : 0.5,
              pointerEvents: session.metadata ? 'auto' : 'none'
            }}
            title={tooltip}
            disabled={!session.metadata}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!isActive && session.metadata) {
                el.style.borderColor = '#e10600';
                el.style.color = '#e10600';
                el.style.background = 'rgba(225, 6, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!isActive) {
                el.style.borderColor = 'var(--f1-border)';
                el.style.color = '#9ca3af';
                el.style.background = 'var(--f1-dark-gray)';
              }
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
