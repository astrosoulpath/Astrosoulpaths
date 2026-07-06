import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { KundliStorageMode, KundliSummary } from "../types/kundli.types";

type KundliState = {
  activeSource: KundliStorageMode;
  openSearchQuery: string;
  recentLocalKundlis: KundliSummary[];
  setSource: (source: KundliStorageMode) => void;
  setOpenSearchQuery: (query: string) => void;
  addLocalKundli: (kundli: KundliSummary) => void;
};

const demoKundlis: KundliSummary[] = [
  {
    id: "loc-1",
    fullName: "Aarav Sharma",
    gender: "male",
    dateOfBirth: "21/09/1995",
    timeOfBirth: "08:35",
    birthPlace: "Jaipur, Rajasthan",
    source: "local",
    createdAt: new Date().toISOString(),
  },
  {
    id: "loc-2",
    fullName: "Ananya Verma",
    gender: "female",
    dateOfBirth: "14/02/1998",
    timeOfBirth: "22:10",
    birthPlace: "Varanasi, Uttar Pradesh",
    source: "local",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const useKundliStore = create<KundliState>()(
  persist(
    (set) => ({
      activeSource: "local",
      openSearchQuery: "",
      recentLocalKundlis: demoKundlis,
      setSource: (source) => set({ activeSource: source }),
      setOpenSearchQuery: (query) => set({ openSearchQuery: query }),
      addLocalKundli: (kundli) =>
        set((state) => ({
          recentLocalKundlis: [kundli, ...state.recentLocalKundlis].slice(
            0,
            20,
          ),
        })),
    }),
    {
      name: "kundli-local-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSource: state.activeSource,
        openSearchQuery: state.openSearchQuery,
        recentLocalKundlis: state.recentLocalKundlis,
      }),
    },
  ),
);
