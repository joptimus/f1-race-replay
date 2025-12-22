import React from "react";

interface QualiPlaybackControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
}

export const QualiPlaybackControls: React.FC<QualiPlaybackControlsProps> = ({
  currentTime,
  duration,
  isPlaying,
  speed,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onStepForward,
  onStepBackward,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-black/50 border-t border-white/10">
      <button
        onClick={onStepBackward}
        className="p-2 text-white/70 hover:text-white transition-colors"
        title="Step backward"
      >
        ◀◀
      </button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        className="p-3 bg-f1-red rounded-full text-white hover:bg-red-700 transition-colors"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <button
        onClick={onStepForward}
        className="p-2 text-white/70 hover:text-white transition-colors"
        title="Step forward"
      >
        ▶▶
      </button>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-white/60 font-mono w-12">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration}
          step={0.04}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-f1-red
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #e10600 0%, #e10600 ${progress}%, rgba(255,255,255,0.2) ${progress}%, rgba(255,255,255,0.2) 100%)`,
          }}
        />

        <span className="text-xs text-white/60 font-mono w-12">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              speed === s
                ? "bg-f1-red text-white"
                : "bg-white/10 text-white/60 hover:text-white"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
