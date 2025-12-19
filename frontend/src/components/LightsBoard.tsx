import { useEffect, forwardRef, useImperativeHandle } from 'react';
import { useLightsBoard } from '../hooks/useLightsBoard';

interface LightsBoardProps {
  onSequenceComplete: () => void;
}

export interface LightsBoardHandle {
  startSequence: () => void;
}

export const LightsBoard = forwardRef<LightsBoardHandle, LightsBoardProps>(({ onSequenceComplete }, ref) => {
  const lightsBoard = useLightsBoard();
  const { isVisible, lightsOn, currentPhase, canSkip, skipSequence, startSequence, mainAudioRef } = lightsBoard;

  useImperativeHandle(ref, () => ({
    startSequence: () => {
      console.log('LightsBoard: startSequence called');
      startSequence();
    },
  }));

  // Notify parent when sequence completes
  useEffect(() => {
    if (!isVisible && currentPhase === 'idle') {
      onSequenceComplete();
    }
  }, [isVisible, currentPhase, onSequenceComplete]);

  if (!isVisible) return null;

  const fadeOutClass = currentPhase === 'fadeout' ? 'opacity-0' : 'opacity-100';

  return (
    <>
      {/* Dark overlay with blur */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-700 ease-out ${fadeOutClass}`}
        style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
      />

      {/* Modal container */}
      <div
        className={`fixed inset-0 flex items-center justify-center transition-opacity duration-700 ease-out ${fadeOutClass}`}
        style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
      >
        {/* Modal box */}
        <div className="relative bg-white rounded-lg p-12 shadow-2xl">
          {/* Skip button */}
          {canSkip && (
            <button
              onClick={skipSequence}
              className="absolute top-4 right-4 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Skip
            </button>
          )}

          {/* Lights container */}
          <div className="flex gap-4 justify-center">
            {lightsOn.map((isLit, idx) => (
              <div
                key={idx}
                className={`w-16 h-16 rounded-full transition-all duration-200 ${
                  isLit
                    ? 'bg-red-600 shadow-lg shadow-red-600'
                    : 'bg-gray-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hidden audio element for main audio */}
      <audio ref={mainAudioRef} preload="auto" crossOrigin="anonymous" />
    </>
  );
});
