/**
 * 3D Track visualization using Three.js
 * Shows F1 track with driver positions in real-time
 */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useSelectedDriver, useSessionMetadata, useSectorColors } from "../store/replayStore";

function findSectorBoundaryIndices(sectors: number[] | undefined): { s1: number; s2: number } | null {
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
  const initRef = useRef(false);
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();
  const sessionMetadata = useSessionMetadata();
  const { isEnabled: showSectorColors } = useSectorColors();

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

      // Add sector labels as tags in the corner
      if (geometry.sector && containerRef.current) {
        const boundaries = findSectorBoundaryIndices(geometry.sector);
        if (boundaries) {
          const sectorInfo = [
            { label: "SECTOR 1", color: "#00e5ff" },
            { label: "SECTOR 2", color: "#b700ff" },
            { label: "SECTOR 3", color: "#ffd400" },
          ];

          sectorInfo.forEach(({ label, color }, idx) => {
            if (containerRef.current) {
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
              tagDiv.style.top = `${16 + idx * 52}px`;
              tagDiv.style.left = "16px";
              tagDiv.style.fontFamily = "monospace";

              containerRef.current.appendChild(tagDiv);
              sectorLabelsRef.current.push(tagDiv);
            }
          });
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
        sectorLabelsRef.current.forEach((label) => label.remove());
        sectorLabelsRef.current = [];
      };
    } catch (error) {
      console.error("Error building track geometry:", error);
      return () => {
        scene.remove(trackGroup);
        sectorLabelsRef.current.forEach((label) => label.remove());
        sectorLabelsRef.current = [];
      };
    }
  }, [sessionMetadata?.track_geometry]);

  // Update driver positions on each frame
  useEffect(() => {
    if (!sceneRef.current || !currentFrame || !containerRef.current) return;

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
          label.style.padding = '4px 8px';
          label.style.backgroundColor = `rgb(${teamColor[0]}, ${teamColor[1]}, ${teamColor[2]})`;
          label.style.color = 'white';
          label.style.fontSize = '12px';
          label.style.fontWeight = '700';
          label.style.fontFamily = 'monospace';
          label.style.borderRadius = '4px';
          label.style.pointerEvents = 'none';
          label.style.zIndex = '10';
          label.textContent = code;
          container.appendChild(label);
          driverLabelsRef.current.set(code, label);
        }

        // Project mesh position to screen coordinates and update label position
        if (camera) {
          const vector = new THREE.Vector3(x, 50, y);
          vector.project(camera);

          const screenX = (vector.x * 0.5 + 0.5) * container.clientWidth;
          const screenY = (-vector.y * 0.5 + 0.5) * container.clientHeight;

          label.style.left = screenX - 20 + 'px';
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
      {/* Weather Panel at Top-Left */}
      {currentFrame?.weather && (
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
              <span>{Math.round(currentFrame.weather.track_temp)}°C</span>
            </div>
            <div style={{ whiteSpace: 'nowrap', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: '#d1d5db', fontWeight: 700 }}>AIR:</span>
              <span>{Math.round(currentFrame.weather.air_temp)}°C</span>
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
    </div>
  );
};

export default TrackVisualization3D;
