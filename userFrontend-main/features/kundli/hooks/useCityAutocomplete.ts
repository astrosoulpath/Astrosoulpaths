import { searchGeoSuggestions } from "@/features/kundli/api/kundli.api";
import { GeoSuggestion } from "@/features/kundli/types/kundli.types";
import debounce from "lodash.debounce";
import React from "react";

const SEARCH_DEBOUNCE_MS = 400;

type UseCityAutocompleteResult = {
  suggestions: GeoSuggestion[];
  isLoading: boolean;
  errorMessage: string | null;
  hasSearched: boolean;
  clearSuggestions: () => void;
};

export function useCityAutocomplete(query: string): UseCityAutocompleteResult {
  const [suggestions, setSuggestions] = React.useState<GeoSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const clearSuggestions = React.useCallback(() => {
    setSuggestions([]);
    setIsLoading(false);
    setErrorMessage(null);
    setHasSearched(false);
  }, []);

  React.useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      clearSuggestions();
      return;
    }

    const activeRequestId = requestIdRef.current + 1;
    requestIdRef.current = activeRequestId;
    const controller = new AbortController();

    const debouncedSearch = debounce(async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const nextSuggestions = await searchGeoSuggestions(
          normalizedQuery,
          controller.signal,
        );

        if (requestIdRef.current !== activeRequestId) {
          return;
        }

        setSuggestions(nextSuggestions);
        setHasSearched(true);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestIdRef.current !== activeRequestId
        ) {
          return;
        }

        setSuggestions([]);
        setHasSearched(true);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load city suggestions.",
        );
      } finally {
        if (requestIdRef.current === activeRequestId) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    debouncedSearch();

    return () => {
      controller.abort();
      debouncedSearch.cancel();
    };
  }, [clearSuggestions, query]);

  return {
    suggestions,
    isLoading,
    errorMessage,
    hasSearched,
    clearSuggestions,
  };
}
