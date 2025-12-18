import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionMetadata } from "../store/replayStore";
import { useComparisonStore } from "../store/comparisonStore";
import { comparisonService } from "../services/comparisonService";
import { DriverSelector } from "./comparison/DriverSelector";
import { TelemetryCharts } from "./comparison/TelemetryCharts";
import { SectorTimesTable } from "./comparison/SectorTimesTable";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";

export const ComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const metadata = useSessionMetadata();
  const {
    selectedDrivers,
    isLoading,
    error,
    setLapTelemetry,
    setSectorTimes,
    setLoading,
    setError,
  } = useComparisonStore();

  useEffect(() => {
    if (!metadata) {
      navigate('/');
    }
  }, [metadata, navigate]);

  const handleLoadData = async () => {
    if (!metadata || selectedDrivers.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const driverCodes = selectedDrivers.map(d => d.code);
      const lapNumbers = selectedDrivers.map(d => d.lapNumber);

      const [telemetryData, sectorData] = await Promise.all([
        comparisonService.fetchLapTelemetry(
          metadata.year,
          metadata.round,
          metadata.session_type,
          driverCodes,
          lapNumbers
        ),
        comparisonService.fetchSectorTimes(
          metadata.year,
          metadata.round,
          metadata.session_type,
          driverCodes,
          lapNumbers
        ),
      ]);

      setLapTelemetry(telemetryData);
      setSectorTimes(sectorData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (!metadata) {
    return null;
  }

  return (
    <div className="app-container" style={{ gridTemplateColumns: '300px 1fr' }}>
      <header className="app-header" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/replay')}
            style={{
              background: 'var(--f1-red)',
              border: 'none',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '1rem',
              color: 'white',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as any).style.background = '#c70000';
              (e.currentTarget as any).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as any).style.background = 'var(--f1-red)';
              (e.currentTarget as any).style.boxShadow = 'none';
            }}
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div style={{ background: 'var(--f1-red)', padding: '4px 12px', fontWeight: 900, fontSize: '0.75rem' }}>
            COMPARISON
          </div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            TELEMETRY COMPARISON
          </h1>
        </div>
      </header>

      <aside style={{ background: 'var(--f1-black)', padding: '16px', borderRadius: '8px', border: '1px solid var(--f1-border)', overflow: 'auto' }}>
        <DriverSelector />

        <button
          onClick={handleLoadData}
          disabled={selectedDrivers.length === 0 || isLoading}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '12px',
            background: selectedDrivers.length > 0 ? 'var(--f1-red)' : '#374151',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 700,
            cursor: selectedDrivers.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (selectedDrivers.length > 0 && !isLoading) {
              (e.currentTarget as any).style.background = '#c70000';
              (e.currentTarget as any).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedDrivers.length > 0 && !isLoading) {
              (e.currentTarget as any).style.background = 'var(--f1-red)';
              (e.currentTarget as any).style.boxShadow = 'none';
            }
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Loading...
            </>
          ) : (
            'Load Telemetry'
          )}
        </button>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '12px',
              padding: '8px',
              background: '#7f1d1d',
              border: '1px solid #991b1b',
              borderRadius: '4px',
              color: '#fca5a5',
              fontSize: '0.85rem'
            }}
          >
            {error}
          </motion.div>
        )}
      </aside>

      <main style={{ background: 'var(--f1-carbon)', padding: '24px', borderRadius: '8px', border: '1px solid var(--f1-border)', overflow: 'auto' }}>
        <TelemetryCharts />
        <div style={{ marginTop: '32px' }}>
          <SectorTimesTable />
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
