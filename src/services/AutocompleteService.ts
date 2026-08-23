import { fuzzyMatch } from '../lib/fuzzyMatch';
import { commandDatabase, type CommandDef, type CommandCategory } from '../lib/autocompleteData';

export interface CommandEntry {
  id: string;
  command: string;
  description: string;
  category: string;
  frequency: number;
  lastUsed: number;
  userRating: number;
  customSuggestion: boolean;
}

export interface Suggestion {
  command: string;
  description: string;
  category: CommandCategory;
  score: number;
  isCustom: boolean;
  matchIndices: number[];
  frequency: number;
}

interface UsageStats {
  command: string;
  count: number;
  lastUsed: number;
}

const STORAGE_KEY = 'novossh-autocomplete-usage';

function loadUsageStats(): Map<string, UsageStats> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as UsageStats[];
    return new Map(arr.map((s) => [s.command, s]));
  } catch {
    return new Map();
  }
}

function saveUsageStats(stats: Map<string, UsageStats>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(stats.values())));
  } catch {
    // best effort
  }
}

class AutocompleteService {
  private usageStats = loadUsageStats();

  getSuggestions(input: string, limit = 12): Suggestion[] {
    if (!input || input.length === 0) return [];
    const inputLower = input.toLowerCase();
    const results: Suggestion[] = [];

    for (const cmd of commandDatabase) {
      const match = fuzzyMatch(cmd.command, input);
      if (!match) continue;

      let score = match.score;
      const stats = this.usageStats.get(cmd.command);
      if (stats) {
        score += Math.min(stats.count * 3, 30);
        const hoursSinceUse = (Date.now() - stats.lastUsed) / (1000 * 60 * 60);
        if (hoursSinceUse < 1) score += 15;
        else if (hoursSinceUse < 24) score += 8;
        else if (hoursSinceUse < 168) score += 3;
      }

      results.push({
        command: cmd.command,
        description: cmd.description,
        category: cmd.category,
        score,
        isCustom: false,
        matchIndices: match.indices,
        frequency: stats?.count ?? 0,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  recordUsage(command: string) {
    const stats = this.usageStats.get(command);
    if (stats) {
      stats.count++;
      stats.lastUsed = Date.now();
    } else {
      this.usageStats.set(command, {
        command,
        count: 1,
        lastUsed: Date.now(),
      });
    }
    saveUsageStats(this.usageStats);
  }

  getUsageStats(): UsageStats[] {
    return Array.from(this.usageStats.values()).sort((a, b) => b.count - a.count);
  }

  getTopCommands(limit = 20): string[] {
    return this.getUsageStats()
      .slice(0, limit)
      .map((s) => s.command);
  }
}

export const autocompleteService = new AutocompleteService();
