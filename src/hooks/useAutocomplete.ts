import { useState, useCallback, useRef, useEffect } from 'react';
import { autocompleteService, type Suggestion } from '../services/AutocompleteService';

export interface UseAutocompleteReturn {
  suggestions: Suggestion[];
  selectedIndex: number;
  visible: boolean;
  loading: boolean;
  getSuggestions: (input: string) => void;
  selectNext: () => void;
  selectPrev: () => void;
  selectIndex: (idx: number) => void;
  getSelected: () => Suggestion | null;
  recordUsage: (command: string) => void;
  hide: () => void;
  show: () => void;
}

export const useAutocomplete = (debounceMs = 50): UseAutocompleteReturn => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSuggestions = useCallback(
    (input: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!input || input.length < 2) {
        setSuggestions([]);
        setVisible(false);
        setSelectedIndex(0);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(() => {
        const results = autocompleteService.getSuggestions(input, 12);
        setSuggestions(results);
        setVisible(results.length > 0);
        setSelectedIndex(0);
        setLoading(false);
      }, debounceMs);
    },
    [debounceMs]
  );

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
  }, [suggestions.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
  }, [suggestions.length]);

  const selectIndex = useCallback((idx: number) => {
    setSelectedIndex(idx);
  }, []);

  const getSelected = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      return suggestions[selectedIndex];
    }
    return null;
  }, [suggestions, selectedIndex]);

  const recordUsage = useCallback((command: string) => {
    autocompleteService.recordUsage(command);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setSuggestions([]);
    setSelectedIndex(0);
  }, []);

  const show = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    suggestions,
    selectedIndex,
    visible,
    loading,
    getSuggestions,
    selectNext,
    selectPrev,
    selectIndex,
    getSelected,
    recordUsage,
    hide,
    show,
  };
};
