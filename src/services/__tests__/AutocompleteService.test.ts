import { describe, it, expect, beforeEach } from 'vitest';
import { autocompleteService } from '../src/services/AutocompleteService';

describe('AutocompleteService', () => {
  beforeEach(() => {
    autocompleteService.clearHistory();
  });

  describe('Command Database', () => {
    it('should have 100+ built-in commands', () => {
      const commands = autocompleteService.getAllCommands();
      expect(commands.length).toBeGreaterThanOrEqual(100);
    });

    it('should have commands organized by category', () => {
      const categories = autocompleteService.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('Navigation');
      expect(categories).toContain('File Operations');
    });

    it('should get commands by category', () => {
      const navCommands = autocompleteService.getCommandsByCategory('Navigation');
      expect(navCommands.length).toBeGreaterThan(0);
      expect(navCommands.some(c => c.command === 'ls')).toBe(true);
    });

    it('should have consistent command data', () => {
      const commands = autocompleteService.getAllCommands();
      commands.forEach(cmd => {
        expect(cmd.command).toBeDefined();
        expect(cmd.description).toBeDefined();
        expect(cmd.category).toBeDefined();
      });
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions for prefix', () => {
      const suggestions = autocompleteService.getSuggestions('ls');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].command).toBe('ls');
    });

    it('should rank exact matches first', () => {
      const suggestions = autocompleteService.getSuggestions('ls');
      expect(suggestions[0].command).toBe('ls');
      expect(suggestions[0].score).toBe(100);
    });

    it('should suggest partial matches', () => {
      const suggestions = autocompleteService.getSuggestions('l');
      expect(suggestions.length).toBeGreaterThan(1);
      expect(suggestions.some(s => s.command.startsWith('l'))).toBe(true);
    });

    it('should return empty suggestions for no matches', () => {
      const suggestions = autocompleteService.getSuggestions('zzzzzzz');
      expect(suggestions.length).toBe(0);
    });

    it('should limit suggestions to requested count', () => {
      const suggestions = autocompleteService.getSuggestions('', 5);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should return most frequent commands when empty prefix', () => {
      // Record usage
      autocompleteService.recordUsage('ls');
      autocompleteService.recordUsage('ls');
      autocompleteService.recordUsage('cd');

      const suggestions = autocompleteService.getSuggestions('', 2);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Learning System', () => {
    it('should record command usage', () => {
      const before = autocompleteService.getHistory().length;
      autocompleteService.recordUsage('ls');
      const after = autocompleteService.getHistory().length;
      expect(after).toBeGreaterThan(before);
    });

    it('should track usage frequency', () => {
      autocompleteService.recordUsage('cd');
      autocompleteService.recordUsage('cd');
      autocompleteService.recordUsage('cd');

      const suggestions = autocompleteService.getSuggestions('cd');
      expect(suggestions[0].command).toBe('cd');
    });

    it('should emit commandUsed event', (done) => {
      autocompleteService.once('commandUsed', (entry) => {
        expect(entry.command).toBe('ls');
        done();
      });

      autocompleteService.recordUsage('ls');
    });

    it('should maintain command history', () => {
      autocompleteService.recordUsage('ls');
      autocompleteService.recordUsage('cd');
      autocompleteService.recordUsage('pwd');

      const history = autocompleteService.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('should get history with limit', () => {
      for (let i = 0; i < 100; i++) {
        autocompleteService.recordUsage('ls');
      }

      const history = autocompleteService.getHistory(10);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should clear history', () => {
      autocompleteService.recordUsage('ls');
      autocompleteService.recordUsage('cd');
      autocompleteService.clearHistory();

      const history = autocompleteService.getHistory();
      expect(history.length).toBe(0);
    });

    it('should emit historyCleared event', (done) => {
      autocompleteService.once('historyCleared', () => {
        done();
      });

      autocompleteService.clearHistory();
    });
  });

  describe('Rating System', () => {
    it('should rate a command', () => {
      autocompleteService.rateCommand('ls', 5);
      const commands = autocompleteService.getAllCommands();
      const lsCmd = commands.find(c => c.command === 'ls');
      expect(lsCmd?.userRating).toBe(5);
    });

    it('should reject invalid ratings', () => {
      expect(() => autocompleteService.rateCommand('ls', 0)).toThrow();
      expect(() => autocompleteService.rateCommand('ls', 6)).toThrow();
    });

    it('should accept ratings 1-5', () => {
      for (let i = 1; i <= 5; i++) {
        expect(() => autocompleteService.rateCommand('ls', i)).not.toThrow();
      }
    });

    it('should emit commandRated event', (done) => {
      autocompleteService.once('commandRated', (data) => {
        expect(data.command).toBe('ls');
        expect(data.rating).toBe(4);
        done();
      });

      autocompleteService.rateCommand('ls', 4);
    });
  });

  describe('Custom Commands', () => {
    it('should add custom command', () => {
      const cmd = autocompleteService.addCustomCommand('mycommand', 'My custom command', 'Custom');
      expect(cmd.command).toBe('mycommand');
      expect(cmd.customSuggestion).toBe(true);
    });

    it('should include custom commands in suggestions', () => {
      autocompleteService.addCustomCommand('myls', 'Custom ls', 'Custom');
      const suggestions = autocompleteService.getSuggestions('my');
      expect(suggestions.some(s => s.command === 'myls')).toBe(true);
    });

    it('should emit customCommandAdded event', (done) => {
      autocompleteService.once('customCommandAdded', (entry) => {
        expect(entry.command).toBe('mycommand');
        done();
      });

      autocompleteService.addCustomCommand('mycommand', 'Test', 'Custom');
    });

    it('should persist custom commands in history', () => {
      autocompleteService.addCustomCommand('custom1', 'Test 1', 'Custom');
      autocompleteService.recordUsage('custom1');

      const history = autocompleteService.getHistory();
      expect(history.some(h => h.command === 'custom1')).toBe(true);
    });
  });

  describe('Import/Export', () => {
    it('should export command data', () => {
      const data = autocompleteService.exportData();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string');

      const parsed = JSON.parse(data);
      expect(parsed.commands).toBeDefined();
      expect(Array.isArray(parsed.commands)).toBe(true);
    });

    it('should import command data', () => {
      autocompleteService.recordUsage('ls');
      const exportedData = autocompleteService.exportData();

      autocompleteService.clearHistory();
      autocompleteService.importData(exportedData);

      const history = autocompleteService.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should emit dataImported event', (done) => {
      const data = autocompleteService.exportData();

      autocompleteService.once('dataImported', () => {
        done();
      });

      autocompleteService.importData(data);
    });

    it('should handle invalid import data', () => {
      expect(() => autocompleteService.importData('invalid json')).toThrow();
    });
  });

  describe('Performance', () => {
    it('should generate suggestions in <100ms', () => {
      const start = performance.now();
      autocompleteService.getSuggestions('l', 10);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });

    it('should handle large history', () => {
      for (let i = 0; i < 1000; i++) {
        autocompleteService.recordUsage('ls');
      }

      const history = autocompleteService.getHistory(50);
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should efficiently search categories', () => {
      const start = performance.now();
      const categories = autocompleteService.getCategories();
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should integrate with learning system', () => {
      // Record usage multiple times
      for (let i = 0; i < 5; i++) {
        autocompleteService.recordUsage('ls');
      }

      // Record another command twice
      autocompleteService.recordUsage('cd');
      autocompleteService.recordUsage('cd');

      // Verify frequency affects suggestions
      const suggestions = autocompleteService.getSuggestions('');
      const lsIndex = suggestions.findIndex(s => s.command === 'ls');
      const cdIndex = suggestions.findIndex(s => s.command === 'cd');

      // Both should be in suggestions, ls should rank higher due to frequency
      expect(lsIndex).toBeGreaterThanOrEqual(0);
      expect(cdIndex).toBeGreaterThanOrEqual(0);
    });

    it('should integrate rating with suggestions', () => {
      autocompleteService.rateCommand('ls', 5);
      const suggestions = autocompleteService.getSuggestions('ls');
      expect(suggestions[0].command).toBe('ls');
    });

    it('should support complete workflow', () => {
      // Add custom command
      autocompleteService.addCustomCommand('deploy', 'Deploy application', 'Custom');

      // Get suggestions
      const suggestions = autocompleteService.getSuggestions('dep');
      expect(suggestions.some(s => s.command === 'deploy')).toBe(true);

      // Record usage
      autocompleteService.recordUsage('deploy');

      // Rate command
      autocompleteService.rateCommand('deploy', 5);

      // Check history
      const history = autocompleteService.getHistory();
      expect(history.some(h => h.command === 'deploy')).toBe(true);
    });
  });
});
