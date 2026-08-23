import { FC } from 'react';
import { Suggestion } from '../../services/AutocompleteService';
import styles from './SuggestionMenu.module.css';

interface SuggestionMenuProps {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSelect: (command: string) => void;
}

const SuggestionMenu: FC<SuggestionMenuProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.menu}>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          className={`${styles.item} ${
            index === selectedIndex ? styles.selected : ''
          }`}
          onClick={() => onSelect(suggestion.command)}
          onMouseEnter={() => {}}
        >
          <div className={styles.command}>
            <span className={styles.text}>{suggestion.command}</span>
            {suggestion.isCustom && (
              <span className={styles.badge}>custom</span>
            )}
          </div>
          <div className={styles.description}>{suggestion.description}</div>
          <div className={styles.category}>{suggestion.category}</div>
        </button>
      ))}
    </div>
  );
};

export default SuggestionMenu;
