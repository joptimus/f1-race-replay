import React from "react";
import { QualiSegmentName } from "../types";

interface QualiSegmentTabsProps {
  activeSegment: QualiSegmentName;
  onSegmentChange: (segment: QualiSegmentName) => void;
  hasQ1: boolean;
  hasQ2: boolean;
  hasQ3: boolean;
}

export const QualiSegmentTabs: React.FC<QualiSegmentTabsProps> = ({
  activeSegment,
  onSegmentChange,
  hasQ1,
  hasQ2,
  hasQ3,
}) => {
  const tabs: { name: QualiSegmentName; label: string; available: boolean }[] = [
    { name: "Q1", label: "Q1", available: hasQ1 },
    { name: "Q2", label: "Q2", available: hasQ2 },
    { name: "Q3", label: "Q3", available: hasQ3 },
  ];

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.name}
          onClick={() => tab.available && onSegmentChange(tab.name)}
          disabled={!tab.available}
          className={`px-4 py-2 text-sm font-mono font-bold rounded-t transition-colors ${
            activeSegment === tab.name
              ? "bg-f1-red text-white"
              : tab.available
              ? "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
              : "bg-white/5 text-white/20 cursor-not-allowed"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
