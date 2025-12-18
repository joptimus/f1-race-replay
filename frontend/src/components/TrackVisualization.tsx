/**
 * Three.js track visualization with Lerp interpolation
 * Renders track circuit and driver positions smoothly
 */

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useCurrentFrame, usePlaybackState } from "../store/replayStore";

interface TrackVisualizationProps {
  trackData?: {
    centerLine: Array<[number, number]>;
    innerEdge: Array<[number, number]>;
    outerEdge: Array<[number, number]>;
  };
  driverColors: Record<string, [number, number, number]>;
}

/**
 * Scene component that renders track and drivers
 */
const ReplayScene = ({
  trackData,
  driverColors,
}: TrackVisualizationProps) => {
  useThree();
  const currentFrame = useCurrentFrame();
  const playback = usePlaybackState();
  const interpolationRef = useRef<number>(0);

  // Build track lines
  useEffect(() => {
    if (!trackData) return;

    // TODO: Build Three.js geometry for track
    // This would render the inner/outer edges as lines
  }, [trackData]);

  // Update interpolation factor based on playback
  useFrame(() => {
    if (!currentFrame) return;

    // Interpolation factor (0-1) for smooth movement between frames
    interpolationRef.current = playback.isPlaying
      ? (interpolationRef.current + 0.016 * playback.speed) % 1.0
      : 0;
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 100, 50]} intensity={0.8} />

      {/* Track geometry */}
      {trackData && (
        <group>
          {/* Track outer edge */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array(
                  trackData.outerEdge.flatMap(([x, y]) => [x, 0, y])
                )}
                count={trackData.outerEdge.length}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial attach="material" color="#808080" />
          </lineSegments>

          {/* Track inner edge */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array(
                  trackData.innerEdge.flatMap(([x, y]) => [x, 0, y])
                )}
                count={trackData.innerEdge.length}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial attach="material" color="#404040" />
          </lineSegments>
        </group>
      )}

      {/* Driver positions */}
      {currentFrame && currentFrame.drivers &&
        Object.entries(currentFrame.drivers).map(([code, driver]) => {
          const color = driverColors[code] || [255, 255, 255];
          const hexColor = `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

          return (
            <group key={code} position={[driver.x, 2, driver.y]}>
              {/* Driver car sphere */}
              <mesh>
                <sphereGeometry args={[3, 16, 16]} />
                <meshStandardMaterial
                  color={hexColor}
                  emissive={hexColor}
                  emissiveIntensity={0.5}
                />
              </mesh>

              {/* Driver label */}
              {/* TODO: Add text label using troika-three-text or similar */}
            </group>
          );
        })}
    </>
  );
};

/**
 * Main track visualization component
 */
export const TrackVisualization: React.FC<TrackVisualizationProps> = ({
  trackData,
  driverColors,
}) => {
  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <Canvas
        camera={{
          position: [0, 150, 150],
          fov: 45,
          near: 0.1,
          far: 10000,
        }}
        onCreated={(state) => {
          state.camera.lookAt(0, 0, 0);
        }}
      >
        <ReplayScene trackData={trackData} driverColors={driverColors} />
        <OrbitControls />
      </Canvas>
    </div>
  );
};

export default TrackVisualization;
