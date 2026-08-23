import { Client, type ConnectConfig } from 'ssh2';
import type { WebSocket } from 'ws';
import type { ConnectionMetadata } from './connectionRouter.js';
import { getDb } from './db/connection.js';
import { SessionService } from './services/SessionService.js';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

type IncomingMessage =
  | {
      type: 'connect';
      host: string;
      port?: number;
      username: string;
      password?: string;
      privateKey?: string;
      passphrase?: string;
      certificate?: string;
      cols?: number;
      rows?: number;
      term?: string;
      via?: { host: string; port: number };
      connectionMode?: string;
      /** Recorded vault-connect session id (from POST /api/sessions), if any. */
      sessionId?: string;
    }
  | { type: 'data'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'disconnect' }
  | { type: 'ping' };

type OutgoingMessage =
  | { type: 'status'; status: 'connecting' | 'connected' | 'disconnected'; message?: string }
  | { type: 'data'; data: string }
  | { type: 'error'; message: string };

export function handleSshConnection(
  ws: WebSocket,
  getConnectionMetadata?: (hostAddress: string, connectionMode?: string) => ConnectionMetadata,
  userId?: string,
): void {
  const db = getDb();
  const sessionService = new SessionService();
  let conn: Client | null = null;
  let stream: ReturnType<Client['shell']> extends void ? never : any = null;
  let sessionId: string | null = null;
  // Buffer to detect commands typed by the user (lines ending with \r or \n)
  let inputBuffer = '';

  // Recorded vault-connect session (server/routes/sessions.ts), independent of ssh_session_logs above.
  let vaultSessionId: string | null = null;
  let lastCommandId: string | null = null;
  let outputBuffer = '';

  const flushCommandOutput = () => {
    if (lastCommandId && outputBuffer.length > 0) {
      sessionService.updateCommand(lastCommandId, outputBuffer.slice(-8000), 0).catch(() => {});
    }
    outputBuffer = '';
  };

  const send = (msg: OutgoingMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const cleanup = () => {
    if (sessionId && userId) {
      db`UPDATE ssh_session_logs SET ended_at = NOW(), status = 'disconnected' WHERE id = ${sessionId}`.catch(() => {});
    }
    if (vaultSessionId) {
      flushCommandOutput();
      sessionService.endSession(vaultSessionId).catch(() => {});
      vaultSessionId = null;
      lastCommandId = null;
    }
    try {
      stream?.end?.();
    } catch {}
    try {
      conn?.end();
    } catch {}
    stream = null;
    conn = null;
    sessionId = null;
  };

  ws.on('message', (raw) => {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send({ type: 'error', message: 'invalid json' });
      return;
    }

    if (msg.type === 'connect') {
      if (conn) {
        send({ type: 'error', message: 'already connected' });
        return;
      }
      send({ type: 'status', status: 'connecting' });

      if (msg.sessionId && userId) {
        vaultSessionId = msg.sessionId;
      }

      // Determine connection mode for analytics
      let connectionMode = msg.connectionMode ?? 'relay';
      if (msg.via) connectionMode = 'relay';
      else if (/^100\.\d+\.\d+\.\d+$/.test(msg.host) || msg.host.includes('.ts.net')) connectionMode = 'tailscale';

      // Insert session log row; store id for update on disconnect
      if (userId) {
        db`
          INSERT INTO ssh_session_logs (user_id, host_address, host_port, host_username, connection_mode, status)
          VALUES (${userId}, ${msg.host}, ${msg.port ?? 22}, ${msg.username}, ${connectionMode}, 'connecting')
          RETURNING id
        `.then(rows => { sessionId = (rows[0] as any)?.id ?? null; }).catch(() => {});
      }

      const config: ConnectConfig = {
        host: msg.via?.host ?? msg.host,
        port: msg.via?.port ?? msg.port ?? 22,
        username: msg.username,
        readyTimeout: 15_000,
        keepaliveInterval: 30_000,
      };

      // If target is a Tailscale IP (100.x.x.x) or Tailscale hostname, route through reverse tunnel
      if (!msg.via && (/^100\.\d+\.\d+\.\d+$/.test(msg.host) || (msg.host.endsWith('.ts.net') && !msg.host.includes('..')))) {
        config.host = 'localhost';
        config.port = 2222;
      }

      // Apply connection metadata routing hints
      if (getConnectionMetadata) {
        const metadata = getConnectionMetadata(msg.host, msg.connectionMode);
        if (metadata.connectionMode === 'tailscale' && !msg.via) {
          config.host = 'localhost';
          config.port = 2222;
        }
        if (metadata.requiresRelay && !msg.via) {
          console.log(`[ssh] Connection to ${msg.host} requires relay per metadata`);
        }
      }
      if (msg.password) config.password = msg.password;
      if (msg.privateKey) {
        config.privateKey = msg.privateKey;
      }
      if (msg.passphrase) config.passphrase = msg.passphrase;

      // Cert auth: ssh2 doesn't support certificates, shell out to system ssh
      if (msg.certificate && msg.privateKey) {
        const tmpDir = join('/tmp', `ssh-cert-${randomBytes(8).toString('hex')}`);
        mkdirSync(tmpDir, { recursive: true });
        // Key filename must NOT have a matching -cert.pub, otherwise ssh auto-loads
        // both the plain key AND the cert, causing sshd to reject the plain key first.
        const keyPath = join(tmpDir, 'identity');
        const certPath = join(tmpDir, 'cert.pub');
        writeFileSync(keyPath, msg.privateKey, { mode: 0o600 });
        writeFileSync(certPath, msg.certificate);

        const targetHost = msg.via?.host ?? msg.host;
        const targetPort = msg.via?.port ?? msg.port ?? 22;

        const sshArgs = [
          '-i', keyPath,
          '-o', `CertificateFile=${certPath}`,
          '-o', 'IdentitiesOnly=yes',
          '-p', String(targetPort),
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          '-t',
          `${msg.username}@${targetHost}`,
        ];

        const sshProc = spawn('ssh', sshArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TERM: msg.term ?? 'xterm-256color' },
        });

        conn = { end: () => { try { sshProc.kill(); } catch {} } } as any;
        stream = sshProc.stdout;

        sshProc.on('error', (err) => {
          send({ type: 'error', message: `ssh error: ${err.message}` });
          cleanup();
          try { unlinkSync(keyPath); unlinkSync(certPath); } catch {}
          try { require('fs').rmdirSync(tmpDir); } catch {}
        });

        sshProc.on('close', () => {
          send({ type: 'status', status: 'disconnected' });
          cleanup();
          try { unlinkSync(keyPath); unlinkSync(certPath); } catch {}
          try { require('fs').rmdirSync(tmpDir); } catch {}
        });

        sshProc.stdout.on('data', (chunk: Buffer) => {
          send({ type: 'data', data: chunk.toString('utf8') });
        });

        sshProc.stderr.on('data', (chunk: Buffer) => {
          send({ type: 'data', data: chunk.toString('utf8') });
        });

        // Store stdin ref for the existing message handler to use
        (ws as any)._sshProcStdin = sshProc.stdin;
        (ws as any)._sshProc = sshProc;

        send({ type: 'status', status: 'connected' });
        if (sessionId && userId) {
          db`UPDATE ssh_session_logs SET status = 'connected' WHERE id = ${sessionId}`.catch(() => {});
        }
        return;
      }

      const client = new Client();
      conn = client;

      client.on('ready', () => {
        client.shell(
          { term: msg.term ?? 'xterm-256color', cols: msg.cols ?? 80, rows: msg.rows ?? 24 },
          (err, sh) => {
            if (err) {
              send({ type: 'error', message: `shell error: ${err.message}` });
              cleanup();
              return;
            }
            stream = sh;
            send({ type: 'status', status: 'connected' });

            if (sessionId && userId) {
              db`UPDATE ssh_session_logs SET status = 'connected' WHERE id = ${sessionId}`.catch(() => {});
            }

            sh.on('data', (chunk: Buffer) => {
              const text = chunk.toString('utf8');
              send({ type: 'data', data: text });
              if (vaultSessionId) {
                // Cap outputBuffer at 1MB to prevent unbounded memory growth
                const MAX_OUTPUT = 1_048_576;
                if (outputBuffer.length < MAX_OUTPUT) {
                  outputBuffer += text;
                  if (outputBuffer.length > MAX_OUTPUT) {
                    outputBuffer = outputBuffer.slice(-MAX_OUTPUT);
                  }
                }
              }
            });
            sh.stderr.on('data', (chunk: Buffer) => {
              const text = chunk.toString('utf8');
              send({ type: 'data', data: text });
              if (vaultSessionId) outputBuffer += text;
            });
            sh.on('close', () => {
              send({ type: 'status', status: 'disconnected' });
              cleanup();
            });
          },
        );
      });

      client.on('error', (err) => {
        if (sessionId && userId) {
          db`UPDATE ssh_session_logs SET status = 'error', error_message = ${err.message}, ended_at = NOW() WHERE id = ${sessionId}`.catch(() => {});
          sessionId = null;
        }
        send({ type: 'error', message: err.message });
        cleanup();
      });

      client.on('end', () => {
        send({ type: 'status', status: 'disconnected' });
        cleanup();
      });

      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        if (msg.password && prompts.length > 0) {
          finish(prompts.map(() => msg.password!));
        } else {
          finish([]);
        }
      });

      try {
        client.connect({ ...config, tryKeyboard: true });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        cleanup();
      }
    } else if (msg.type === 'data') {
      // Cert auth: write to ssh process stdin instead of ssh2 stream
      const certStdin = (ws as any)._sshProcStdin;
      if (certStdin) {
        certStdin.write(msg.data);
      } else {
        stream?.write?.(msg.data);
      }
      // Detect complete commands (user presses Enter) for analytics
      if ((sessionId || vaultSessionId) && userId) {
        inputBuffer += msg.data;
        const lines = inputBuffer.split(/\r|\n/);
        inputBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const cmd = line.trim();
          if (cmd.length > 0) {
            if (sessionId) {
              db`INSERT INTO ssh_command_logs (session_id, user_id, command) VALUES (${sessionId}, ${userId}, ${cmd})`.catch(() => {});
            }
            if (vaultSessionId) {
              flushCommandOutput();
              sessionService.recordCommand(vaultSessionId, userId, cmd)
                .then((row) => { lastCommandId = row.id; })
                .catch(() => {});
            }
          }
        }
      }
    } else if (msg.type === 'resize') {
      // Cert auth: can't resize after spawn, skip
      const certProc = (ws as any)._sshProc;
      if (!certProc) {
        try {
          stream?.setWindow?.(msg.rows, msg.cols, 0, 0);
        } catch (err) {
          console.error('[ssh] resize failed:', err);
        }
      }
    } else if (msg.type === 'disconnect') {
      cleanup();
      send({ type: 'status', status: 'disconnected' });
    } else if (msg.type === 'ping') {
      // keepalive — no-op
    }
  });

  ws.on('close', () => {
    cleanup();
  });
  ws.on('error', () => {
    cleanup();
  });
}
