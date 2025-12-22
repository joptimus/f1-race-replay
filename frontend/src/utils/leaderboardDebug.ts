/**
 * Leaderboard Debug Utility
 *
 * Tracks frame data consistency and logs driver disappearances/reappearances
 * Use this to verify leaderboard stability across the first 150 frames
 */

export interface FrameDriverSnapshot {
  frameIndex: number;
  time: number;
  driverCodes: Set<string>;
  driverCount: number;
  positions: Map<string, number>;
}

export interface DebugReport {
  totalFramesAnalyzed: number;
  droppedDriverEvents: DroppedDriverEvent[];
  missingDrivers: Set<string>;
  frameGaps: FrameGap[];
  consistencyScore: number;
}

export interface DroppedDriverEvent {
  frameIndex: number;
  time: number;
  driverCode: string;
  position: number;
  reason: 'completely_missing' | 'reappeared' | 'position_changed';
}

export interface FrameGap {
  frameStart: number;
  frameEnd: number;
  driverCode: string;
  durationFrames: number;
}

class LeaderboardDebugger {
  private frameHistory: Map<number, FrameDriverSnapshot> = new Map();
  private maxFramesToTrack: number = 150;
  private debugLogs: string[] = [];
  private enableConsoleLogging: boolean = true;

  constructor(enableConsoleLogging: boolean = false) {
    this.enableConsoleLogging = enableConsoleLogging;
  }

  /**
   * Log frame data
   */
  logFrame(frameIndex: number, time: number, drivers: Record<string, any>) {
    if (frameIndex > this.maxFramesToTrack) {
      return; // Stop tracking after 150 frames
    }

    const driverCodes = new Set(Object.keys(drivers));
    const positions = new Map<string, number>();

    Object.entries(drivers).forEach(([code, data]: [string, any]) => {
      if (data.position) {
        positions.set(code, data.position);
      }
    });

    const snapshot: FrameDriverSnapshot = {
      frameIndex,
      time,
      driverCodes,
      driverCount: driverCodes.size,
      positions,
    };

    this.frameHistory.set(frameIndex, snapshot);

    // Check for anomalies
    if (frameIndex > 0) {
      const previousSnapshot = this.frameHistory.get(frameIndex - 1);
      if (previousSnapshot) {
        this.checkFrameConsistency(previousSnapshot, snapshot);
      }
    }
  }

  /**
   * Check consistency between consecutive frames
   */
  private checkFrameConsistency(prev: FrameDriverSnapshot, current: FrameDriverSnapshot) {
    // Find drivers that were present but are now missing
    const missingDrivers = new Set<string>();
    prev.driverCodes.forEach(code => {
      if (!current.driverCodes.has(code)) {
        missingDrivers.add(code);
      }
    });

    // Find drivers that newly appeared
    const newDrivers = new Set<string>();
    current.driverCodes.forEach(code => {
      if (!prev.driverCodes.has(code)) {
        newDrivers.add(code);
      }
    });

    // Log anomalies
    if (missingDrivers.size > 0) {
      missingDrivers.forEach(code => {
        const prevPos = prev.positions.get(code);
        const message = `[Frame ${current.frameIndex}] ⚠️  DRIVER DISAPPEARED: ${code} (was at P${prevPos})`;
        this.log(message);
        if (this.enableConsoleLogging) {
          console.warn(message);
        }
      });
    }

    if (newDrivers.size > 0) {
      newDrivers.forEach(code => {
        const currPos = current.positions.get(code);
        const message = `[Frame ${current.frameIndex}] ℹ️  DRIVER REAPPEARED: ${code} (now at P${currPos})`;
        this.log(message);
        if (this.enableConsoleLogging) {
          console.log(message);
        }
      });
    }

    // Check for unexpected position changes
    prev.positions.forEach((prevPos, code) => {
      const currPos = current.positions.get(code);
      if (currPos && currPos !== prevPos) {
        // Position change is normal, but log large jumps (>2 positions in one frame)
        const posDiff = Math.abs(currPos - prevPos);
        if (posDiff > 2) {
          const message = `[Frame ${current.frameIndex}] 🔄 LARGE POSITION CHANGE: ${code} P${prevPos} → P${currPos} (Δ${posDiff})`;
          this.log(message);
          if (this.enableConsoleLogging) {
            console.info(message);
          }
        }
      }
    });

    // Check driver count consistency
    const countDiff = current.driverCount - prev.driverCount;
    if (countDiff !== 0 && !missingDrivers.has('any')) {
      const message = `[Frame ${current.frameIndex}] 📊 Driver count changed: ${prev.driverCount} → ${current.driverCount} (Δ${countDiff > 0 ? '+' : ''}${countDiff})`;
      this.log(message);
      if (this.enableConsoleLogging && Math.abs(countDiff) > 1) {
        console.warn(message);
      }
    }
  }

  /**
   * Generate comprehensive debug report
   */
  generateReport(): DebugReport {
    const droppedDriverEvents: DroppedDriverEvent[] = [];
    const missingDrivers = new Set<string>();
    const frameGaps = new Map<string, FrameGap[]>();

    // Analyze each driver's presence across frames
    const allDrivers = new Set<string>();
    this.frameHistory.forEach(snapshot => {
      snapshot.driverCodes.forEach(code => allDrivers.add(code));
    });

    allDrivers.forEach(driverCode => {
      let lastSeenFrame = -1;
      let inGap = false;
      let gapStart = -1;

      for (let i = 0; i <= this.maxFramesToTrack; i++) {
        const snapshot = this.frameHistory.get(i);
        if (!snapshot) break;

        if (snapshot.driverCodes.has(driverCode)) {
          // Driver is present
          if (inGap && lastSeenFrame >= 0) {
            // End of gap
            const gapDuration = i - gapStart;
            if (!frameGaps.has(driverCode)) {
              frameGaps.set(driverCode, []);
            }
            frameGaps.get(driverCode)!.push({
              frameStart: gapStart,
              frameEnd: i,
              driverCode,
              durationFrames: gapDuration,
            });

            droppedDriverEvents.push({
              frameIndex: gapStart,
              time: this.frameHistory.get(gapStart)?.time || 0,
              driverCode,
              position: this.frameHistory.get(gapStart - 1)?.positions.get(driverCode) || 0,
              reason: 'completely_missing',
            });

            droppedDriverEvents.push({
              frameIndex: i,
              time: snapshot.time,
              driverCode,
              position: snapshot.positions.get(driverCode) || 0,
              reason: 'reappeared',
            });

            inGap = false;
          }
          lastSeenFrame = i;
        } else if (lastSeenFrame >= 0 && i > 0) {
          // Driver was present before but missing now
          if (!inGap) {
            gapStart = i;
            inGap = true;
          }
        }
      }

      // Track if driver was ever missing
      if (frameGaps.has(driverCode) && frameGaps.get(driverCode)!.length > 0) {
        missingDrivers.add(driverCode);
      }
    });

    // Calculate consistency score (0-100)
    // 100 = perfect, no drivers disappeared
    // Decreases based on number of disappearance events
    const consistencyScore = Math.max(
      0,
      100 - (droppedDriverEvents.length / 2) * 5 // Each disappearance/reappearance pair = -5 points
    );

    return {
      totalFramesAnalyzed: Math.min(this.frameHistory.size, this.maxFramesToTrack),
      droppedDriverEvents: droppedDriverEvents.sort((a, b) => a.frameIndex - b.frameIndex),
      missingDrivers,
      frameGaps: Array.from(frameGaps.values()).flat(),
      consistencyScore,
    };
  }

  /**
   * Print formatted debug report to console
   */
  printReport() {
    const report = this.generateReport();

    console.group('🏎️ Leaderboard Debug Report');
    console.log(`📊 Frames Analyzed: ${report.totalFramesAnalyzed} / ${this.maxFramesToTrack}`);
    console.log(`✅ Consistency Score: ${report.consistencyScore.toFixed(1)}/100`);
    console.log(`⚠️  Missing Drivers: ${report.missingDrivers.size}`);

    if (report.missingDrivers.size > 0) {
      console.group('Drivers with Disappearances:');
      report.missingDrivers.forEach(code => {
        console.log(`  ${code}`);
      });
      console.groupEnd();
    }

    if (report.droppedDriverEvents.length > 0) {
      console.group(`Disappearance Events: ${report.droppedDriverEvents.length}`);
      report.droppedDriverEvents.forEach(event => {
        const icon = event.reason === 'completely_missing' ? '❌' : '✅';
        console.log(
          `${icon} Frame ${event.frameIndex} (${event.time.toFixed(2)}s): ${event.driverCode} P${event.position} - ${event.reason}`
        );
      });
      console.groupEnd();
    }

    if (report.frameGaps.length > 0) {
      console.group(`Frame Gaps (Total: ${report.frameGaps.length})`);
      const gapsByDriver = new Map<string, FrameGap[]>();
      report.frameGaps.forEach(gap => {
        if (!gapsByDriver.has(gap.driverCode)) {
          gapsByDriver.set(gap.driverCode, []);
        }
        gapsByDriver.get(gap.driverCode)!.push(gap);
      });

      gapsByDriver.forEach((gaps, driverCode) => {
        console.group(`${driverCode}:`);
        gaps.forEach(gap => {
          console.log(
            `  Frames ${gap.frameStart}-${gap.frameEnd} (${gap.durationFrames} frames)`
          );
        });
        console.groupEnd();
      });
      console.groupEnd();
    }

    console.log('\n📋 Debug Logs:');
    this.debugLogs.slice(-20).forEach(log => console.log(log));

    console.groupEnd();
  }

  /**
   * Export report as JSON
   */
  exportReport(): string {
    const report = this.generateReport();
    return JSON.stringify(report, (_key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }, 2);
  }

  /**
   * Internal logging
   */
  private log(message: string) {
    this.debugLogs.push(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Get frame history for analysis
   */
  getFrameHistory(): Map<number, FrameDriverSnapshot> {
    return new Map(this.frameHistory);
  }

  /**
   * Clear history
   */
  clear() {
    this.frameHistory.clear();
    this.debugLogs = [];
  }
}

// Export singleton instance
export const leaderboardDebugger = new LeaderboardDebugger(false);

// Also export class for testing
export default LeaderboardDebugger;
