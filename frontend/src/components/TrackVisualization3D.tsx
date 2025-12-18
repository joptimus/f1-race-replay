/**
 * 3D Track visualization using Three.js
 * Shows F1 track with driver positions in real-time
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useCurrentFrame, useSelectedDriver, useSessionMetadata, useSectorColors } from "../store/replayStore";
import { getTeamLogoPath } from "../utils/teamLogoMap";
import { MapSettingsPanel } from "./MapSettingsPanel";
import { Settings } from "lucide-react";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

interface SectorBoundary {
  s1: number;
  s2: number;
}

function findSectorBoundaryIndices(sectors: number[] | undefined): SectorBoundary | null {
  if (!sectors || sectors.length === 0) return null;

  let s1Start = 0;
  let s2Start = 0;

  for (let i = 1; i < sectors.length; i++) {
    if (sectors[i] !== sectors[i - 1]) {
      if (s1Start === 0 && sectors[i] === 2) {
        s1Start = i;
      } else if (s2Start === 0 && sectors[i] === 3) {
        s2Start = i;
        break;
      }
    }
  }

  return s1Start > 0 && s2Start > 0 ? { s1: s1Start, s2: s2Start } : null;
}

function calculateSectorCentroid(
  startIdx: number,
  endIdx: number,
  innerX: number[],
  innerY: number[],
  outerX: number[],
  outerY: number[]
): { x: number; y: number } {
  const sectorLength = endIdx - startIdx;

  if (sectorLength <= 0) {
    const idx = Math.min(startIdx, innerX.length - 1);
    return {
      x: (innerX[idx] + outerX[idx]) / 2,
      y: (innerY[idx] + outerY[idx]) / 2
    };
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  const sampleInterval = Math.max(1, Math.floor(sectorLength / 5));

  for (let i = startIdx; i < endIdx; i += sampleInterval) {
    const idx = Math.min(i, innerX.length - 1);
    sumX += (innerX[idx] + outerX[idx]) / 2;
    sumY += (innerY[idx] + outerY[idx]) / 2;
    count++;
  }

  const idx = Math.min(endIdx - 1, innerX.length - 1);
  sumX += (innerX[idx] + outerX[idx]) / 2;
  sumY += (innerY[idx] + outerY[idx]) / 2;
  count++;

  return {
    x: sumX / count,
    y: sumY / count
  };
}

export const TrackVisualization3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const driverMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const driverLabelsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const sectorLabelsRef = useRef<HTMLDivElement[]>([]);
  const trackMeshRef = useRef<THREE.Mesh | null>(null);
  const trackMaterialColorsRef = useRef<Float32Array | null>(null);
  const sectorBoundaryLinesRef = useRef<THREE.Group | null>(null);
  const rainSegmentsRef = useRef<THREE.LineSegments | null>(null);
  const rainUniformsRef = useRef({ time: { value: 0 } });
  const clockRef = useRef<THREE.Clock | null>(null);
  const composerRef = useRef<InstanceType<typeof EffectComposer> | null>(null);
  const noiseRenderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const bloomPassRef = useRef<InstanceType<typeof UnrealBloomPass> | null>(null);
  const initRef = useRef(false);
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();
  const sessionMetadata = useSessionMetadata();
  const { isEnabled: showSectorColors, toggle: toggleSectorColors } = useSectorColors();
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showWeatherPanel, setShowWeatherPanel] = useState(true);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [currentSessionType, setCurrentSessionType] = useState<'R' | 'S' | 'Q' | 'FP1' | 'FP2' | 'FP3'>('R');

  // Setup scene and track (only once)
  useEffect(() => {
    if (!containerRef.current) {
      console.log("Container not ready");
      return;
    }

    if (initRef.current) {
      console.log("Scene already initialized");
      return;
    }

    try {
      console.log("Initializing Three.js scene...");
      const container = containerRef.current;
      initRef.current = true;

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f0f12);
      sceneRef.current = scene;

      // Camera setup
      const width = container.clientWidth;
      const height = container.clientHeight;
      console.log("Container dimensions:", { width, height });

      const camera = new THREE.OrthographicCamera(
        -width / 2, width / 2, height / 2, -height / 2, 0.1, 100000
      );
      // Top-down view
      camera.position.set(0, 5000, 0);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;
      console.log("Orthographic camera created for top-down view");

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: false
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x0f0f12, 1);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      console.log("Renderer created and appended to DOM", {
        canvasFound: !!renderer.domElement,
        containerHasCanvas: container.querySelector('canvas') !== null
      });

      // Lighting - simple for flat view
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
      scene.add(ambientLight);

      // Initialize shader-based rain (line segments)
      const gCount = 15000;
      const gPos: number[] = [];
      const gEnds: number[] = [];

      for (let i = 0; i < gCount; i++) {
        const x = THREE.MathUtils.randFloatSpread(15000);
        const y = THREE.MathUtils.randFloat(-100, 500);
        const z = THREE.MathUtils.randFloatSpread(15000);
        const len = THREE.MathUtils.randFloat(40, 80);

        gPos.push(x, y, z, x, y, z);
        gEnds.push(0, len, 1, len);
      }

      const rainGeo = new THREE.BufferGeometry();
      rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
      rainGeo.setAttribute('gEnds', new THREE.Float32BufferAttribute(gEnds, 2));

      const rainMat = new THREE.LineBasicMaterial({
        color: 0x87ceeb,
        transparent: true,
        opacity: 0.9,
      });

      (rainMat as any).onBeforeCompile = (shader: any) => {
        shader.uniforms.time = rainUniformsRef.current.time;
        shader.vertexShader = `
          uniform float time;
          attribute vec2 gEnds;
          varying float vGEnds;
          ${shader.vertexShader}
        `.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
          vec3 pos = position;
          pos.y = -mod(500. - (pos.y - time * 1200.), 600.) + 500.;
          pos.y += gEnds.x * gEnds.y;
          transformed = pos;
          vGEnds = gEnds.x;`
        );
        shader.fragmentShader = `
          varying float vGEnds;
          ${shader.fragmentShader}
        `.replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `float op = 1. - vGEnds;
          op = pow(op, 2.);
          op *= 0.8;
          vec4 diffuseColor = vec4( diffuse, op * opacity );`
        );
      };

      const rainLines = new THREE.LineSegments(rainGeo, rainMat);
      rainSegmentsRef.current = rainLines;
      clockRef.current = new THREE.Clock();

      // Handle window resize
      const handleWindowResize = () => {
        if (!containerRef.current || !renderer) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (camera instanceof THREE.OrthographicCamera) {
          camera.left = -width / 2;
          camera.right = width / 2;
          camera.top = height / 2;
          camera.bottom = -height / 2;
        }
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener("resize", handleWindowResize);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);

        // Update rain shader time uniform
        if (clockRef.current) {
          rainUniformsRef.current.time.value = clockRef.current.getElapsedTime();
        }

        renderer.render(scene, camera);
      };

      animate();

      // Cleanup
      return () => {
        console.log("Cleanup called, initRef.current:", initRef.current);
        window.removeEventListener("resize", handleWindowResize);
        // Only cleanup if we're truly unmounting (not a Strict Mode remount)
        if (initRef.current === false) {
          if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
            containerRef.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
        }
      };
    } catch (error) {
      console.error("Error initializing Three.js scene:", error);
    }
  }, []);

  // Build track geometry when metadata is available
  useEffect(() => {
    if (!sceneRef.current || !sessionMetadata?.track_geometry) {
      console.log("Track geometry not ready:", { hasScene: !!sceneRef.current, hasGeometry: !!sessionMetadata?.track_geometry });
      return;
    }

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!camera) return;

    const geometry = sessionMetadata.track_geometry;
    console.log("Building track geometry with bounds:", { x_min: geometry.x_min, x_max: geometry.x_max, y_min: geometry.y_min, y_max: geometry.y_max });

    // Validate arrays have content
    if (!geometry.centerline_x?.length || !geometry.outer_x?.length || !geometry.inner_x?.length) {
      console.error("Track geometry arrays are empty or invalid");
      return;
    }

    // Track geometry from telemetry
    const trackGroup = new THREE.Group();

    try {
      // Create flat track surface mesh from centerline
      if (geometry.centerline_x.length > 1) {
        console.log("Creating track surface mesh");
        const trackGeom = new THREE.BufferGeometry();
        const positions: number[] = [];
        const colors: number[] = [];

        const innerPoints = geometry.inner_x.map((x, i) => ({ x, y: geometry.inner_y[i] }));
        const outerPoints = geometry.outer_x.map((x, i) => ({ x, y: geometry.outer_y[i] }));

        const numPoints = Math.min(innerPoints.length, outerPoints.length);

        const sectorColors: Record<number, { r: number; g: number; b: number }> = {
          1: { r: 0.0, g: 0.898, b: 1.0 },
          2: { r: 0.718, g: 0.0, b: 1.0 },
          3: { r: 1.0, g: 0.831, b: 0.0 },
        };

        for (let i = 0; i < numPoints; i++) {
          positions.push(innerPoints[i].x, 0, innerPoints[i].y);
          positions.push(outerPoints[i].x, 0, outerPoints[i].y);

          let sectorColor = sectorColors[3];
          if (geometry.sector && geometry.sector[i]) {
            const sectorIndex = geometry.sector[i];
            sectorColor = sectorColors[sectorIndex] || sectorColors[3];
          }

          colors.push(sectorColor.r, sectorColor.g, sectorColor.b);
          colors.push(sectorColor.r, sectorColor.g, sectorColor.b);
        }

        trackGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        trackGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

        const indices: number[] = [];
        for (let i = 0; i < numPoints - 1; i++) {
          const a = i * 2;
          const b = a + 1;
          const c = (i + 1) * 2;
          const d = c + 1;

          indices.push(a, c, b);
          indices.push(b, c, d);
        }

        trackGeom.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        trackGeom.computeVertexNormals();

        const trackMaterial = new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          wireframe: false,
        });
        const trackMesh = new THREE.Mesh(trackGeom, trackMaterial);
        trackMesh.position.z = -1;
        trackGroup.add(trackMesh);

        trackMeshRef.current = trackMesh;
        trackMaterialColorsRef.current = new Float32Array(colors);
      }

      // Create outer track edge as a thick LINE using TubeGeometry
      if (geometry.outer_x.length > 1) {
        console.log("Creating outer track edge with", geometry.outer_x.length, "points");
        const outerPoints = geometry.outer_x.map((x, i) => new THREE.Vector3(x, 0.5, geometry.outer_y[i]));
        const outerCurve = new THREE.CatmullRomCurve3(outerPoints);
        const tubeGeom = new THREE.TubeGeometry(outerCurve, geometry.outer_x.length - 1, 8, 4, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const outerTube = new THREE.Mesh(tubeGeom, tubeMaterial);
        trackGroup.add(outerTube);
      }

      // Create inner track edge as a thick LINE using TubeGeometry
      if (geometry.inner_x.length > 1) {
        console.log("Creating inner track edge with", geometry.inner_x.length, "points");
        const innerPoints = geometry.inner_x.map((x, i) => new THREE.Vector3(x, 0.5, geometry.inner_y[i]));
        const innerCurve = new THREE.CatmullRomCurve3(innerPoints);
        const tubeGeom = new THREE.TubeGeometry(innerCurve, geometry.inner_x.length - 1, 8, 4, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const innerTube = new THREE.Mesh(tubeGeom, tubeMaterial);
        trackGroup.add(innerTube);
      }


      // Calculate bounds for camera positioning
      const boundsX = geometry.x_max - geometry.x_min;
      const boundsY = geometry.y_max - geometry.y_min;
      const centerX = (geometry.x_min + geometry.x_max) / 2;
      const centerY = (geometry.y_min + geometry.y_max) / 2;
      const maxBound = Math.max(boundsX, boundsY);

      // Position camera for orthographic top-down view
      if (camera instanceof THREE.OrthographicCamera) {
        camera.position.set(centerX, 5000, centerY);
        camera.left = -maxBound / 2 * 1.1;
        camera.right = maxBound / 2 * 1.1;
        camera.top = maxBound / 2 * 1.1;
        camera.bottom = -maxBound / 2 * 1.1;
        camera.updateProjectionMatrix();
      }

      console.log("Camera positioned for top-down view, Center:", { centerX, centerY }, "Bounds:", { boundsX, boundsY, maxBound });

      if (geometry.sector && containerRef.current && camera instanceof THREE.OrthographicCamera) {
        const boundaries = findSectorBoundaryIndices(geometry.sector);
        if (boundaries) {
          const sectorInfo = [
            { label: "SECTOR 1", color: "#00e5ff", rgb: { r: 0, g: 229, b: 255 } },
            { label: "SECTOR 2", color: "#b700ff", rgb: { r: 183, g: 0, b: 255 } },
            { label: "SECTOR 3", color: "#ffd400", rgb: { r: 255, g: 212, b: 0 } },
          ];

          const boundaryGroup = new THREE.Group();

          const s1EndIdx = boundaries.s1;
          const s2EndIdx = boundaries.s2;
          const totalPoints = geometry.centerline_x.length;

          const line1InnerPos = new THREE.Vector3(
            geometry.inner_x[s1EndIdx],
            0,
            geometry.inner_y[s1EndIdx]
          );
          const line1OuterPos = new THREE.Vector3(
            geometry.outer_x[s1EndIdx],
            0,
            geometry.outer_y[s1EndIdx]
          );

          const line2InnerPos = new THREE.Vector3(
            geometry.inner_x[s2EndIdx],
            0,
            geometry.inner_y[s2EndIdx]
          );
          const line2OuterPos = new THREE.Vector3(
            geometry.outer_x[s2EndIdx],
            0,
            geometry.outer_y[s2EndIdx]
          );

          const startFinishInnerPos = new THREE.Vector3(
            geometry.inner_x[0],
            0,
            geometry.inner_y[0]
          );
          const startFinishOuterPos = new THREE.Vector3(
            geometry.outer_x[0],
            0,
            geometry.outer_y[0]
          );

          function createBoundaryLine(
            innerPos: THREE.Vector3,
            outerPos: THREE.Vector3
          ) {
            const direction = new THREE.Vector3().subVectors(outerPos, innerPos);
            const distance = direction.length();
            const extensionFactor = 0.3;
            const extension = distance * extensionFactor;

            const normalizedDir = direction.clone().normalize();
            const extendedInnerPos = innerPos.clone().addScaledVector(normalizedDir, -extension);
            const extendedOuterPos = outerPos.clone().addScaledVector(normalizedDir, extension);

            const curve = new THREE.LineCurve3(extendedInnerPos, extendedOuterPos);
            const tubeGeom = new THREE.TubeGeometry(curve, 1, 50, 4, false);
            const tubeMaterial = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              fog: false
            });

            return new THREE.Mesh(tubeGeom, tubeMaterial);
          }

          const line1 = createBoundaryLine(line1InnerPos, line1OuterPos);
          const line2 = createBoundaryLine(line2InnerPos, line2OuterPos);
          const startFinishLine = createBoundaryLine(
            startFinishInnerPos,
            startFinishOuterPos
          );

          boundaryGroup.add(line1);
          boundaryGroup.add(line2);
          boundaryGroup.add(startFinishLine);
          scene.add(boundaryGroup);
          sectorBoundaryLinesRef.current = boundaryGroup;

          const sector1Centroid = calculateSectorCentroid(0, s1EndIdx, geometry.inner_x, geometry.inner_y, geometry.outer_x, geometry.outer_y);
          const sector2Centroid = calculateSectorCentroid(s1EndIdx, s2EndIdx, geometry.inner_x, geometry.inner_y, geometry.outer_x, geometry.outer_y);
          const sector3Centroid = calculateSectorCentroid(s2EndIdx, totalPoints - 1, geometry.inner_x, geometry.inner_y, geometry.outer_x, geometry.outer_y);
          const startFinishCentroid = {
            x: (geometry.inner_x[s1EndIdx] + geometry.outer_x[s1EndIdx]) / 2,
            y: (geometry.inner_y[s1EndIdx] + geometry.outer_y[s1EndIdx]) / 2
          };

          const sectorCentroids = [sector1Centroid, sector2Centroid, sector3Centroid];

          sectorInfo.forEach(({ label, color }, idx) => {
            if (containerRef.current && camera) {
              const centroid = sectorCentroids[idx];
              if (!centroid || isNaN(centroid.x) || isNaN(centroid.y)) {
                console.warn(`Invalid sector ${idx + 1} centroid:`, centroid);
                return;
              }

              const centroid3D = new THREE.Vector3(centroid.x, 0, centroid.y);
              const vector = centroid3D.clone();
              vector.project(camera);

              const screenX = (vector.x * 0.5 + 0.5) * containerRef.current.clientWidth;
              const screenY = (-vector.y * 0.5 + 0.5) * containerRef.current.clientHeight;

              const tagDiv = document.createElement("div");
              tagDiv.textContent = label;
              tagDiv.style.position = "absolute";
              tagDiv.style.pointerEvents = "none";
              tagDiv.style.padding = "8px 16px";
              tagDiv.style.fontSize = "14px";
              tagDiv.style.fontWeight = "bold";
              tagDiv.style.color = color;
              tagDiv.style.border = `2px solid ${color}`;
              tagDiv.style.borderRadius = "4px";
              tagDiv.style.backgroundColor = "rgba(15, 15, 18, 0.9)";
              tagDiv.style.whiteSpace = "nowrap";
              tagDiv.style.transform = "translate(-50%, -50%)";
              tagDiv.style.left = `${screenX}px`;
              tagDiv.style.top = `${screenY}px`;
              tagDiv.style.fontFamily = "monospace";

              containerRef.current.appendChild(tagDiv);
              sectorLabelsRef.current.push(tagDiv);
            }
          });

          if (containerRef.current && camera) {
            const sfCentroid3D = new THREE.Vector3(startFinishCentroid.x, 0, startFinishCentroid.y);

            const trackCenter = new THREE.Vector3(centerX, 0, centerY);
            let offsetDir = new THREE.Vector3().subVectors(sfCentroid3D, trackCenter).normalize();
            const offsetDistance = 800;
            let offsetPos = sfCentroid3D.clone().addScaledVector(offsetDir, offsetDistance);

            let sfVector = offsetPos.clone();
            sfVector.project(camera);

            let sfScreenX = (sfVector.x * 0.5 + 0.5) * containerRef.current.clientWidth;
            let sfScreenY = (-sfVector.y * 0.5 + 0.5) * containerRef.current.clientHeight;

            const isInViewport = sfScreenX >= -100 && sfScreenX <= containerRef.current.clientWidth + 100 &&
                                 sfScreenY >= -100 && sfScreenY <= containerRef.current.clientHeight + 100;

            if (!isInViewport) {
              offsetDir = offsetDir.multiplyScalar(-1);
              offsetPos = sfCentroid3D.clone().addScaledVector(offsetDir, offsetDistance);

              sfVector = offsetPos.clone();
              sfVector.project(camera);

              sfScreenX = (sfVector.x * 0.5 + 0.5) * containerRef.current.clientWidth;
              sfScreenY = (-sfVector.y * 0.5 + 0.5) * containerRef.current.clientHeight;
            }

            const sfTagDiv = document.createElement("div");
            sfTagDiv.textContent = "START/FINISH";
            sfTagDiv.style.position = "absolute";
            sfTagDiv.style.pointerEvents = "none";
            sfTagDiv.style.padding = "4px 8px";
            sfTagDiv.style.fontSize = "10px";
            sfTagDiv.style.fontWeight = "bold";
            sfTagDiv.style.color = "#ffffff";
            sfTagDiv.style.border = "1px solid #ffffff";
            sfTagDiv.style.borderRadius = "3px";
            sfTagDiv.style.backgroundColor = "rgba(15, 15, 18, 0.9)";
            sfTagDiv.style.whiteSpace = "nowrap";
            sfTagDiv.style.transform = "translate(-50%, -50%)";
            sfTagDiv.style.left = `${sfScreenX}px`;
            sfTagDiv.style.top = `${sfScreenY}px`;
            sfTagDiv.style.fontFamily = "monospace";

            containerRef.current.appendChild(sfTagDiv);
            sectorLabelsRef.current.push(sfTagDiv);
          }
        }
      }

      if (trackGroup.children.length > 0) {
        scene.add(trackGroup);
        console.log("Track group added to scene, children:", trackGroup.children.length);
      } else {
        console.warn("No track geometry meshes created");
      }

      return () => {
        if (trackGroup.children.length > 0) {
          scene.remove(trackGroup);
        }
        if (sectorBoundaryLinesRef.current) {
          scene.remove(sectorBoundaryLinesRef.current);
        }
        sectorLabelsRef.current.forEach((label) => label.remove());
        sectorLabelsRef.current = [];
      };
    } catch (error) {
      console.error("Error building track geometry:", error);
      return () => {
        scene.remove(trackGroup);
        if (sectorBoundaryLinesRef.current) {
          scene.remove(sectorBoundaryLinesRef.current);
        }
        sectorLabelsRef.current.forEach((label) => label.remove());
        sectorLabelsRef.current = [];
      };
    }
  }, [sessionMetadata?.track_geometry]);

  // Update driver positions on each frame
  useEffect(() => {
    if (!sceneRef.current || !currentFrame || !currentFrame.drivers || !containerRef.current) return;

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const container = containerRef.current;
    const drivers = Object.entries(currentFrame.drivers);

    // Remove drivers that are no longer in the race
    driverMeshesRef.current.forEach((mesh, code) => {
      if (!currentFrame.drivers[code]) {
        scene.remove(mesh);
        driverMeshesRef.current.delete(code);

        // Remove label
        const label = driverLabelsRef.current.get(code);
        if (label) {
          label.remove();
          driverLabelsRef.current.delete(code);
        }
      }
    });

    // Update or create driver meshes
    drivers.forEach(([code, driver]) => {
      const x = driver.x;
      const y = driver.y;

      // Get team color from metadata, fallback to red if not available
      const teamColor = sessionMetadata?.driver_colors?.[code] || [220, 38, 38];
      const hexColor = (teamColor[0] << 16) | (teamColor[1] << 8) | teamColor[2];

      let mesh = driverMeshesRef.current.get(code);

      if (!mesh) {
        // Create new driver mesh - larger sphere for visibility
        const sphereGeometry = new THREE.SphereGeometry(80, 16, 16);
        const color = new THREE.Color(hexColor);
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
        });
        mesh = new THREE.Mesh(sphereGeometry, material);
        scene.add(mesh);
        driverMeshesRef.current.set(code, mesh);
      }

      // Update position
      mesh.position.set(x, 50, y);

      // Update color based on selection
      const material = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = code === selectedDriver?.code;
      if (isSelected) {
        material.emissiveIntensity = 1;
        mesh.scale.set(1.5, 1.5, 1.5);
      } else {
        material.emissiveIntensity = 0.5;
        mesh.scale.set(1, 1, 1);
      }

      // Create or update label for selected driver
      if (isSelected) {
        let label = driverLabelsRef.current.get(code);

        if (!label) {
          label = document.createElement('div');
          label.style.position = 'absolute';
          label.style.display = 'flex';
          label.style.alignItems = 'center';
          label.style.gap = '8px';
          label.style.padding = '6px 12px';
          label.style.backgroundColor = `rgb(${teamColor[0]}, ${teamColor[1]}, ${teamColor[2]})`;
          label.style.color = 'white';
          label.style.fontFamily = 'monospace';
          label.style.borderRadius = '4px';
          label.style.pointerEvents = 'none';
          label.style.zIndex = '10';
          label.style.letterSpacing = '0.05em';

          const textSpan = document.createElement('span');
          textSpan.style.fontSize = '13px';
          textSpan.style.fontWeight = '700';
          label.appendChild(textSpan);

          const img = document.createElement('img');
          img.style.height = '18px';
          img.style.width = 'auto';
          img.onerror = () => { img.style.display = 'none'; };
          label.appendChild(img);

          label.dataset.textSpan = '0';
          label.dataset.img = '1';

          container.appendChild(label);
          driverLabelsRef.current.set(code, label);
        }

        const position = driver.position || '?';
        const teamName = (sessionMetadata as any)?.driver_teams?.[code];

        const textSpan = label.children[0] as HTMLSpanElement;
        const img = label.children[1] as HTMLImageElement;

        textSpan.textContent = `P${position} - ${code}`;

        const logoPath = getTeamLogoPath(teamName);
        if (logoPath) {
          img.src = logoPath;
          img.style.display = 'block';
        } else {
          img.style.display = 'none';
        }

        // Project mesh position to screen coordinates and update label position
        if (camera) {
          const vector = new THREE.Vector3(x, 50, y);
          vector.project(camera);

          const screenX = (vector.x * 0.5 + 0.5) * container.clientWidth;
          const screenY = (-vector.y * 0.5 + 0.5) * container.clientHeight;

          label.style.left = screenX - 80 + 'px';
          label.style.top = screenY - 50 + 'px';
        }
      } else {
        // Remove label if driver is not selected
        const label = driverLabelsRef.current.get(code);
        if (label) {
          label.remove();
          driverLabelsRef.current.delete(code);
        }
      }
    });
  }, [currentFrame, selectedDriver, sessionMetadata?.driver_colors]);

  // Handle sector colors toggle
  useEffect(() => {
    if (!trackMeshRef.current || !trackMaterialColorsRef.current) return;

    const colorAttribute = trackMeshRef.current.geometry.getAttribute("color") as THREE.BufferAttribute;
    if (!colorAttribute) return;

    if (showSectorColors) {
      colorAttribute.array = trackMaterialColorsRef.current;
    } else {
      const grayColors = new Float32Array(trackMaterialColorsRef.current.length);
      const grayValue = 0.3;
      for (let i = 0; i < grayColors.length; i++) {
        grayColors[i] = grayValue;
      }
      colorAttribute.array = grayColors;
    }

    colorAttribute.needsUpdate = true;
  }, [showSectorColors]);

  // Show/hide rain effect based on weather
  useEffect(() => {
    if (!sceneRef.current || !rainSegmentsRef.current) return;

    const isRaining = currentFrame?.weather?.rain_state === 'RAINING';

    if (isRaining && !rainSegmentsRef.current.parent) {
      sceneRef.current.add(rainSegmentsRef.current);
    } else if (!isRaining && rainSegmentsRef.current.parent) {
      sceneRef.current.remove(rainSegmentsRef.current);
    }
  }, [currentFrame?.weather?.rain_state]);

  const convertTemperature = (celsius: number): number => {
    if (temperatureUnit === 'F') {
      return (celsius * 9 / 5) + 32;
    }
    return celsius;
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Session Toggle Buttons at Top-Center */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 24,
          display: 'flex',
          gap: '8px',
          backgroundColor: 'rgba(15, 15, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '8px',
          backdropFilter: 'blur(8px)',
        }}
      >
        {[
          { label: 'FP1', value: 'FP1' as const },
          { label: 'FP2', value: 'FP2' as const },
          { label: 'FP3', value: 'FP3' as const },
          { label: 'QUALI', value: 'Q' as const },
          { label: 'GRAND PRIX', value: 'R' as const },
          { label: 'SPRINT', value: 'S' as const },
        ].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setCurrentSessionType(value === 'Q' ? 'Q' : value === 'R' ? 'R' : value === 'S' ? 'S' : value)}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: currentSessionType === value ? '2px solid #e10600' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              background: currentSessionType === value ? 'rgba(225, 6, 0, 0.2)' : 'transparent',
              color: currentSessionType === value ? '#e10600' : '#9ca3af',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (currentSessionType !== value) {
                (e.currentTarget as any).borderColor = 'rgba(255, 255, 255, 0.4)';
                (e.currentTarget as any).color = '#d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (currentSessionType !== value) {
                (e.currentTarget as any).borderColor = 'rgba(255, 255, 255, 0.2)';
                (e.currentTarget as any).color = '#9ca3af';
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Settings Button at Top-Right */}
      <button
        onClick={() => setShowSettingsPanel(true)}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 25,
          background: '#e10600',
          border: 'none',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as any).style.background = '#c70000';
          (e.currentTarget as any).style.boxShadow = '0 4px 12px rgba(225, 6, 0, 0.3)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as any).style.background = '#e10600';
          (e.currentTarget as any).style.boxShadow = 'none';
        }}
      >
        <Settings size={20} />
      </button>

      {/* Weather Panel at Top-Left */}
      {currentFrame?.weather && showWeatherPanel && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 20,
            background: 'rgba(15, 15, 18, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px 16px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af', letterSpacing: '0.05em', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ whiteSpace: 'nowrap', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: '#d1d5db', fontWeight: 700 }}>TRACK:</span>
              <span>{Math.round(convertTemperature(currentFrame.weather.track_temp))}°{temperatureUnit}</span>
            </div>
            <div style={{ whiteSpace: 'nowrap', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: '#d1d5db', fontWeight: 700 }}>AIR:</span>
              <span>{Math.round(convertTemperature(currentFrame.weather.air_temp))}°{temperatureUnit}</span>
            </div>
            <div style={{ whiteSpace: 'nowrap', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: '#d1d5db', fontWeight: 700 }}>WIND:</span>
              <span>{Math.round(currentFrame.weather.wind_speed)} m/s</span>
            </div>
            {currentFrame.weather.rain_state !== 'Dry' && (
              <div style={{ whiteSpace: 'nowrap', display: 'flex', gap: '4px', alignItems: 'center', color: '#3b82f6' }}>
                <span style={{ color: '#d1d5db', fontWeight: 700 }}>CONDITIONS:</span>
                <span>{currentFrame.weather.rain_state}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Settings Panel */}
      <MapSettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        showSectorColors={showSectorColors}
        onToggleSectorColors={toggleSectorColors}
        showWeatherPanel={showWeatherPanel}
        onToggleWeatherPanel={() => setShowWeatherPanel(!showWeatherPanel)}
        temperatureUnit={temperatureUnit}
        onToggleTemperatureUnit={() => setTemperatureUnit(temperatureUnit === 'C' ? 'F' : 'C')}
      />
    </div>
  );
};

export default TrackVisualization3D;
