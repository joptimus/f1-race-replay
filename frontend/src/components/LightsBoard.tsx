import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { useLightsBoard } from '../hooks/useLightsBoard';

interface LightsBoardProps {
  onSequenceComplete: () => void;
}

export interface LightsBoardHandle {
  startSequence: () => void;
}

const LightsBoardComponent = ({ onSequenceComplete }: LightsBoardProps, ref: React.Ref<LightsBoardHandle>) => {
  const lightsBoard = useLightsBoard();
  const { isVisible, lightsOn, currentPhase, canSkip, skipSequence, startSequence, mainAudioRef } = lightsBoard;
  console.log('LightsBoard render:', { isVisible, lightsOn, currentPhase, canSkip });

  useImperativeHandle(ref, () => ({
    startSequence: () => {
      console.log('LightsBoard: startSequence called');
      startSequence();
    },
  }));

  // Notify parent when sequence completes - only when transitioning to complete state
  useEffect(() => {
    if (!isVisible && currentPhase === 'idle') {
      onSequenceComplete();
    }
  }, [isVisible, currentPhase]);

  const fadeOutClass = currentPhase === 'fadeout' ? 'opacity-0' : 'opacity-100';

  return (
    <>
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Dark overlay with blur */}
          <div
            className={`transition-opacity duration-700 ease-out ${fadeOutClass}`}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal box */}
          <div
            style={{
              position: 'relative',
              zIndex: 10000,
              background: '#1f1f27',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '48px 64px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              minWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
            className={`transition-opacity duration-700 ease-out ${fadeOutClass}`}
          >
            {/* Lights container */}
            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
              {lightsOn.map((isLit, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: isLit ? '#dc2626' : '#1f2937',
                    boxShadow: isLit ? '0 0 20px #dc2626, 0 0 40px #dc2626' : 'none',
                    transition: 'all 200ms ease-out',
                  }}
                />
              ))}
            </div>

            {/* Skip button row */}
            {canSkip && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={skipSequence}
                  style={{
                    background: '#e10600',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#c70000';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#e10600';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden audio element for main audio */}
      <audio ref={mainAudioRef} preload="auto" crossOrigin="anonymous" />
    </>
  );
};

export const LightsBoard = forwardRef<LightsBoardHandle, LightsBoardProps>(LightsBoardComponent);
