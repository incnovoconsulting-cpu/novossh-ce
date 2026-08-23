import { FC } from 'react';
import { CommandEntry } from '../../services/AutocompleteService';
import styles from './CommandHistory.module.css';

interface CommandHistoryProps {
  commands: CommandEntry[];
  onSelect: (command: string) => void;
  onClose: () => void;
}

const CommandHistory: FC<CommandHistoryProps> = ({
  commands,
  onSelect,
  onClose,
}) => {
  if (commands.length === 0) {
    return null;
  }

  const groupedByCategory = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandEntry[]>
  );

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <h4>Recent Commands</h4>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.categories}>
        {Object.entries(groupedByCategory).map(([category, cmds]) => (
          <div key={category} className={styles.category}>
            <div className={styles.categoryTitle}>{category}</div>
            {cmds.slice(0, 5).map((cmd) => (
              <button
                key={cmd.id}
                className={styles.historyItem}
                onClick={() => onSelect(cmd.command)}
              >
                <span className={styles.command}>{cmd.command}</span>
                <span className={styles.frequency}>{cmd.frequency}x</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommandHistory;
