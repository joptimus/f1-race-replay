import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ComparisonDriver, DriverLapTelemetry, SectorTime } from "../types";

interface ComparisonStore {
  selectedDrivers: ComparisonDriver[];
  lapTelemetry: DriverLapTelemetry[];
  sectorTimes: SectorTime[];
  isLoading: boolean;
  error: string | null;

  addDriver: (driver: ComparisonDriver) => void;
  removeDriver: (code: string) => void;
  updateDriverLap: (code: string, lapNumber: number) => void;
  clearDrivers: () => void;

  setLapTelemetry: (data: DriverLapTelemetry[]) => void;
  setSectorTimes: (data: SectorTime[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useComparisonStore = create<ComparisonStore>()(
  subscribeWithSelector((set) => ({
    selectedDrivers: [],
    lapTelemetry: [],
    sectorTimes: [],
    isLoading: false,
    error: null,

    addDriver: (driver) =>
      set((state) => {
        if (state.selectedDrivers.find(d => d.code === driver.code)) {
          return state;
        }
        return { selectedDrivers: [...state.selectedDrivers, driver] };
      }),

    removeDriver: (code) =>
      set((state) => ({
        selectedDrivers: state.selectedDrivers.filter(d => d.code !== code),
      })),

    updateDriverLap: (code, lapNumber) =>
      set((state) => ({
        selectedDrivers: state.selectedDrivers.map(d =>
          d.code === code ? { ...d, lapNumber } : d
        ),
      })),

    clearDrivers: () => set({ selectedDrivers: [] }),

    setLapTelemetry: (data) => set({ lapTelemetry: data }),
    setSectorTimes: (data) => set({ sectorTimes: data }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
  }))
);
