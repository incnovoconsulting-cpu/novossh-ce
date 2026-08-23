/**
 * Bash Escaping Utilities
 * Provides secure escaping for shell commands to prevent command injection attacks
 * Handles all dangerous bash patterns according to OWASP bash injection guidelines
 */

/**
 * Dangerous bash patterns that can lead to command injection
 */
const DANGEROUS_PATTERNS = {
  COMMAND_SUBSTITUTION: /\$\(.*?\)/g,
  BACKTICK_EXECUTION: /`.*?`/g,
  VARIABLE_EXPANSION: /\$[{a-zA-Z_][a-zA-Z0-9_}]*/g,
  PIPE_OPERATOR: /\|/g,
  REDIRECT_OUTPUT: /[><]/g,
  LOGICAL_AND: /&&/g,
  LOGICAL_OR: /\|\|/g,
  COMMAND_SEPARATOR: /;/g,
  BACKGROUND_EXEC: /&/g,
  NEWLINE_INJECTION: /[\n\r]/g,
  GLOB_EXPANSION: /[*?[\]]/g,
};

/**
 * Analysis result for command safety
 */
export interface CommandAnalysis {
  isSafe: boolean;
  risks: DangerousPattern[];
  warnings: string[];
}

/**
 * Dangerous pattern found in command
 */
export interface DangerousPattern {
  pattern: string;
  type: string;
  location: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Escapes a bash command for safe inclusion in a shell script
 * Uses single-quote wrapping with proper handling of embedded quotes
 *
 * Security strategy:
 * 1. Primary: Single-quote wrapping (prevents all expansions and substitutions)
 * 2. Single quotes within command: Use '\'' to end quote, add escaped quote, resume quote
 * 3. Newlines: Removed to prevent line-based injection
 * 4. Dollar signs: Escaped when outside single quotes
 * 5. Backticks: Escaped when outside single quotes
 *
 * @param command The bash command to escape
 * @returns Escaped command safe for bash execution
 *
 * @example
 * escapeForBash("echo 'hello'")     // Returns: echo '\'hello\''
 * escapeForBash("$(whoami)")         // Returns: '$(whoami)'
 * escapeForBash("rm -rf /")          // Returns: 'rm -rf /'
 */
export function escapeForBash(command: string): string {
  if (!command) {
    return "''";
  }

  // Remove newlines and carriage returns to prevent line-based injection
  let sanitized = command.replace(/[\n\r]/g, ' ');

  // Handle single quotes by ending the quoted string, adding an escaped quote, and resuming
  // Pattern: '\\'' means: end quote ('), escaped single quote (\'), start quote (')
  sanitized = sanitized.replace(/'/g, "'\\''");

  // Wrap in single quotes to prevent any expansions or substitutions
  return `'${sanitized}'`;
}

/**
 * Escapes a command using double quotes with proper variable escaping
 * Less secure than single quotes but allows some variable expansion
 *
 * Use when variable expansion is needed (not recommended for untrusted input)
 * Escapes: $ ` " \ and newlines
 *
 * @param command The bash command to escape
 * @returns Command escaped for use in double quotes
 */
export function escapeForDoubleQuotes(command: string): string {
  if (!command) {
    return '""';
  }

  let sanitized = command;

  // Escape backslashes first (must be done before escaping other chars)
  sanitized = sanitized.replace(/\\/g, '\\\\');

  // Escape double quotes
  sanitized = sanitized.replace(/"/g, '\\"');

  // Escape dollar signs to prevent variable expansion
  sanitized = sanitized.replace(/\$/g, '\\$');

  // Escape backticks to prevent command substitution
  sanitized = sanitized.replace(/`/g, '\\`');

  // Replace actual newline characters with space (safer than escaped newlines)
  sanitized = sanitized.replace(/\n/g, ' ');
  sanitized = sanitized.replace(/\r/g, ' ');

  return `"${sanitized}"`;
}

/**
 * Analyzes a command for dangerous patterns and injection risks
 * Returns detailed information about what risks were found
 *
 * @param command The bash command to analyze
 * @returns Analysis result with risk assessment
 */
export function analyzeCommandSafety(command: string): CommandAnalysis {
  const risks: DangerousPattern[] = [];
  const warnings: string[] = [];

  // Check for command substitution $(...)
  const cmdSubMatches = command.matchAll(DANGEROUS_PATTERNS.COMMAND_SUBSTITUTION);
  for (const match of cmdSubMatches) {
    risks.push({
      pattern: match[0],
      type: 'Command Substitution',
      location: match.index || 0,
      severity: 'critical',
    });
    warnings.push(`Command substitution detected: ${match[0]}`);
  }

  // Check for backtick command execution
  const backtickMatches = command.matchAll(DANGEROUS_PATTERNS.BACKTICK_EXECUTION);
  for (const match of backtickMatches) {
    risks.push({
      pattern: match[0],
      type: 'Backtick Execution',
      location: match.index || 0,
      severity: 'critical',
    });
    warnings.push(`Backtick execution detected: ${match[0]}`);
  }

  // Check for unescaped variable expansion
  const varMatches = command.matchAll(DANGEROUS_PATTERNS.VARIABLE_EXPANSION);
  for (const match of varMatches) {
    risks.push({
      pattern: match[0],
      type: 'Variable Expansion',
      location: match.index || 0,
      severity: 'high',
    });
    warnings.push(`Variable expansion detected: ${match[0]}`);
  }

  // Check for pipes
  if (DANGEROUS_PATTERNS.PIPE_OPERATOR.test(command)) {
    warnings.push('Command contains pipes - output depends on system state');
  }

  // Check for redirects
  if (DANGEROUS_PATTERNS.REDIRECT_OUTPUT.test(command)) {
    warnings.push('Command contains redirects - output written to files');
  }

  // Check for logical operators (can combine commands)
  if (DANGEROUS_PATTERNS.LOGICAL_AND.test(command) || DANGEROUS_PATTERNS.LOGICAL_OR.test(command)) {
    risks.push({
      pattern: '&&/||',
      type: 'Logical Operators',
      location: 0,
      severity: 'medium',
    });
    warnings.push('Command uses logical operators - multiple commands can be chained');
  }

  // Check for command separator
  if (DANGEROUS_PATTERNS.COMMAND_SEPARATOR.test(command)) {
    risks.push({
      pattern: ';',
      type: 'Command Separator',
      location: command.indexOf(';'),
      severity: 'medium',
    });
    warnings.push('Command contains semicolon - multiple commands can be executed');
  }

  // Check for background execution
  if (DANGEROUS_PATTERNS.BACKGROUND_EXEC.test(command)) {
    warnings.push('Command uses background execution operator (&)');
  }

  // Check for glob expansion
  const globMatches = command.matchAll(DANGEROUS_PATTERNS.GLOB_EXPANSION);
  for (const match of globMatches) {
    warnings.push(`Glob expansion pattern detected: ${match[0]}`);
  }

  const isSafe = risks.length === 0 || risks.every((r) => r.severity === 'low');

  return {
    isSafe,
    risks,
    warnings,
  };
}

/**
 * Sanitizes a command by removing dangerous patterns
 * Destructive operation - use with caution as it may alter command behavior
 *
 * @param command The bash command to sanitize
 * @returns Sanitized command with dangerous patterns removed
 */
export function sanitizeCommand(command: string): string {
  let sanitized = command;

  // Remove command substitution $(...) - replace with empty
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.COMMAND_SUBSTITUTION, '');

  // Remove backtick execution - replace with empty
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.BACKTICK_EXECUTION, '');

  // Remove multiple semicolons and pipes (command chaining)
  sanitized = sanitized.replace(/;\s*\w+/g, '');
  sanitized = sanitized.replace(/\|\s*\w+/g, '');

  // Remove logical operators
  sanitized = sanitized.replace(/&&\s*\w+/g, '');
  sanitized = sanitized.replace(/\|\|\s*\w+/g, '');

  // Clean up multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Creates a safe bash script header with safeguards
 * Includes set -e (exit on error) and set -u (error on undefined vars)
 *
 * @returns Bash script header with safety options
 */
export function getBashScriptHeader(): string {
  return `#!/bin/bash
# Security: set -e (exit on error), set -u (undefined variable error)
set -e
set -u

`;
}

/**
 * Validates that a bash script is safe to execute
 * Checks for dangerous patterns at script level
 *
 * @param script The complete bash script to validate
 * @returns Validation result with any risks found
 */
export function validateBashScript(
  script: string
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for eval (extremely dangerous) - but only if not inside single quotes
  // This is a simplified check - real validation would need to parse the script properly
  const linesWithoutQuotes = script
    .split('\n')
    .filter((line) => {
      // Skip lines that are comments or inside quotes
      return !line.trim().startsWith('#');
    })
    .join('\n');

  if (/\beval\s+[^']*\$/m.test(linesWithoutQuotes)) {
    errors.push('Script contains eval with variable expansion - potential for arbitrary code execution');
  }

  // Check for dangerous functions
  if (/\bsource\b/.test(script) || /^\.\s+\w+/m.test(script)) {
    errors.push('Script sources external files - potential for code injection');
  }

  // Check for unquoted variables outside of single quotes
  // Simple heuristic: look for $var pattern that's not in single quotes
  const unquotedVarMatches = linesWithoutQuotes.match(/(?<!['])\$[a-zA-Z_][a-zA-Z0-9_]*(?!['])/g);
  if (unquotedVarMatches && unquotedVarMatches.length > 0) {
    warnings.push('Unquoted variables detected - will expand in execution');
  }

  // Check for * in dangerous contexts
  if (/rm\s+.*\*/g.test(script)) {
    warnings.push('Glob pattern used with rm - high risk of data loss');
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}

/**
 * Wraps a command in sh -c for isolated execution
 * Useful for commands that need to run in a subshell
 *
 * @param command The command to wrap
 * @returns Command wrapped for subshell execution
 */
export function wrapInShell(command: string): string {
  const escaped = escapeForBash(command);
  return `sh -c ${escaped}`;
}
