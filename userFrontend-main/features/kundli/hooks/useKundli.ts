import { useMutation, useQuery } from "@tanstack/react-query";
import { createKundli, fetchRecentKundlis } from "../api/kundli.api";
import { useKundliStore } from "../store/kundli.store";
import { CreateKundliRequest, KundliStorageMode } from "../types/kundli.types";

export function useGenerateKundli() {
  const addLocalKundli = useKundliStore((state) => state.addLocalKundli);

  return useMutation({
    mutationFn: (payload: CreateKundliRequest) => createKundli(payload),
    onSuccess: (created) => {
      if (created.source === "local") {
        addLocalKundli(created);
      }
    },
  });
}

export function useOpenKundliList(source: KundliStorageMode, query: string) {
  const localKundlis = useKundliStore((state) => state.recentLocalKundlis);

  const cloudQuery = useQuery({
    queryKey: ["kundli", "recent", source, query],
    queryFn: () => fetchRecentKundlis({ source, query }),
    enabled: source === "cloud",
  });

  const normalized = query.trim().toLowerCase();
  const filteredLocal = localKundlis.filter((item) => {
    if (!normalized) {
      return true;
    }
    const text = `${item.fullName} ${item.birthPlace}`.toLowerCase();
    return text.includes(normalized);
  });

  if (source === "local") {
    return {
      data: filteredLocal,
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  return {
    data: cloudQuery.data ?? [],
    isLoading: cloudQuery.isLoading,
    isError: cloudQuery.isError,
    error: cloudQuery.error,
  };
}
