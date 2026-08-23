import { useState, useRef, useEffect, FC, KeyboardEvent } from 'react';
import { useAutocomplete } from '../../hooks/useAutocomplete';
import styles from './AutocompleteInput.module.css';
import SuggestionMenu from './SuggestionMenu';

interface AutocompleteInputProps {
  onExecute: (command: string) => void;
  placeholder?: string;
}

const AutocompleteInput: FC<AutocompleteInputProps> = ({
  onExecute,
  placeholder = 'Enter command...',
}) => {
  const autocomplete = useAutocomplete();
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.trim()) {
      autocomplete.getSuggestions(input);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && autocomplete.suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < autocomplete.suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : autocomplete.suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            selectSuggestion(autocomplete.suggestions[selectedIndex].command);
          } else {
            executeCommand();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    }
  };

  const selectSuggestion = (command: string) => {
    setInput(command);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const executeCommand = () => {
    const command = input.trim();
    if (command) {
      autocomplete.recordUsage(command);
      onExecute(command);
      setInput('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <span className={styles.prompt}>$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowSuggestions(false);
            }, 200);
          }}
          placeholder={placeholder}
          className={styles.input}
          spellCheck="false"
        />
      </div>

      {showSuggestions && autocomplete.suggestions.length > 0 && (
        <SuggestionMenu
          suggestions={autocomplete.suggestions}
          selectedIndex={selectedIndex}
          onSelect={selectSuggestion}
        />
      )}
    </div>
  );
};

export default AutocompleteInput;
