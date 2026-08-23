import { Client, SFTPWrapper, Stats } from 'ssh2';
import type { ConnectConfig } from 'ssh2';
import { Readable, Writable } from 'node:stream';

export interface SFTPFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifyTime: number;
  permissions: string;
  uid: number;
  gid: number;
}

interface SFTPSession {
  client: Client;
  sftp: SFTPWrapper;
  hostId: string;
  lastUsed: number;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 50;

class SFTPServiceImpl {
  private sessions = new Map<string, SFTPSession>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupIdleSessions(), 60_000);
  }

  async connect(
    hostId: string,
    config: ConnectConfig
  ): Promise<void> {
    if (this.sessions.has(hostId)) {
      this.sessions.get(hostId)!.lastUsed = Date.now();
      return;
    }

    if (this.sessions.size >= MAX_SESSIONS) {
      this.evictOldest();
    }

    const client = new Client();
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('SFTP connection timed out'));
      }, 15_000);

      client.on('ready', () => {
        clearTimeout(timeout);
        client.sftp((err, sftpWrapper) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }
          resolve(sftpWrapper);
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.connect({ ...config, readyTimeout: 15_000 });
    });

    this.sessions.set(hostId, {
      client,
      sftp,
      hostId,
      lastUsed: Date.now(),
    });
  }

  async disconnect(hostId: string): Promise<void> {
    const session = this.sessions.get(hostId);
    if (session) {
      try { session.sftp.end(); } catch {}
      try { session.client.end(); } catch {}
      this.sessions.delete(hostId);
    }
  }

  isConnected(hostId: string): boolean {
    return this.sessions.has(hostId);
  }

  private getSession(hostId: string): SFTPSession {
    const session = this.sessions.get(hostId);
    if (!session) {
      throw new Error(`Not connected to host ${hostId}`);
    }
    session.lastUsed = Date.now();
    return session;
  }

  async listDirectory(hostId: string, remotePath: string): Promise<SFTPFileEntry[]> {
    const session = this.getSession(hostId);
    return new Promise((resolve, reject) => {
      session.sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        const entries: SFTPFileEntry[] = list.map((item) => {
          const isDir = item.attrs.isDirectory();
          return {
            name: item.filename,
            path: remotePath === '/' ? `/${item.filename}` : `${remotePath}/${item.filename}`,
            isDirectory: isDir,
            size: item.attrs.size,
            modifyTime: item.attrs.mtime * 1000,
            permissions: this.modeToPermissions(item.attrs.mode, isDir),
            uid: item.attrs.uid,
            gid: item.attrs.gid,
          };
        });
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        resolve(entries);
      });
    });
  }

  async createDirectory(hostId: string, remotePath: string): Promise<void> {
    const session = this.getSession(hostId);
    return new Promise((resolve, reject) => {
      session.sftp.mkdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deletePath(hostId: string, remotePath: string, isDirectory: boolean): Promise<void> {
    const session = this.getSession(hostId);
    if (isDirectory) {
      return this.rmdirRecursive(session.sftp, remotePath);
    }
    return new Promise((resolve, reject) => {
      session.sftp.unlink(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async rmdirRecursive(sftp: SFTPWrapper, dirPath: string): Promise<void> {
    const entries = await new Promise<Array<{ filename: string; attrs: Stats }>>((resolve, reject) => {
      sftp.readdir(dirPath, (err, list) => {
        if (err) reject(err);
        else resolve(list);
      });
    });

    for (const entry of entries) {
      const childPath = `${dirPath}/${entry.filename}`;
      if (entry.attrs.isDirectory()) {
        await this.rmdirRecursive(sftp, childPath);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(childPath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }

    return new Promise((resolve, reject) => {
      sftp.rmdir(dirPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rename(hostId: string, oldPath: string, newPath: string): Promise<void> {
    const session = this.getSession(hostId);
    return new Promise((resolve, reject) => {
      session.sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stat(hostId: string, remotePath: string): Promise<SFTPFileEntry> {
    const session = this.getSession(hostId);
    return new Promise((resolve, reject) => {
      session.sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        const isDir = stats.isDirectory();
        resolve({
          name: remotePath.split('/').pop() || '',
          path: remotePath,
          isDirectory: isDir,
          size: stats.size,
          modifyTime: stats.mtime * 1000,
          permissions: this.modeToPermissions(stats.mode, isDir),
          uid: stats.uid,
          gid: stats.gid,
        });
      });
    });
  }

  createReadStream(hostId: string, remotePath: string): Readable {
    const session = this.getSession(hostId);
    const readStream = new Readable({ read() {} });

    session.sftp.open(remotePath, 'r', (err, handle) => {
      if (err) {
        readStream.destroy(err);
        return;
      }
      const CHUNK_SIZE = 64 * 1024;
      let offset = 0;
      const readChunk = () => {
        session.sftp.read(handle, Buffer.alloc(CHUNK_SIZE), 0, CHUNK_SIZE, offset, (readErr, bytesRead, buf) => {
          if (readErr) {
            session.sftp.close(handle, () => {});
            readStream.destroy(readErr);
            return;
          }
          if (bytesRead === 0) {
            session.sftp.close(handle, () => {});
            readStream.push(null);
            return;
          }
          offset += bytesRead;
          if (!readStream.push(Buffer.from(buf.slice(0, bytesRead)))) {
            readStream.once('drain', readChunk);
          } else {
            readChunk();
          }
        });
      };
      readChunk();
    });

    return readStream;
  }

  async getFileSize(hostId: string, remotePath: string): Promise<number> {
    const info = await this.stat(hostId, remotePath);
    return info.size;
  }

  createWriteStream(hostId: string, remotePath: string, _fileSize?: number): Writable {
    const session = this.getSession(hostId);
    const writeStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        session.sftp.open(remotePath, 'w', (err, handle) => {
          if (err) {
            callback(err);
            return;
          }
          let offset = 0;
          const writeChunk = () => {
            session.sftp.write(handle, chunk, offset, chunk.length - offset, offset, ((writeErr: any, bytesWritten: any) => {
              if (writeErr) {
                session.sftp.close(handle, () => {});
                callback(writeErr);
                return;
              }
              offset += bytesWritten;
              if (offset < chunk.length) {
                writeChunk();
              } else {
                session.sftp.close(handle, () => {});
                callback();
              }
            }) as any);
          };
          writeChunk();
        });
      },
    });

    return writeStream;
  }

  async uploadFile(
    hostId: string,
    remotePath: string,
    data: Buffer,
    onProgress?: (bytesSent: number, total: number) => void
  ): Promise<void> {
    const session = this.getSession(hostId);
    const totalBytes = data.length;
    let bytesWritten = 0;

    return new Promise((resolve, reject) => {
      session.sftp.open(remotePath, 'w', (err, handle) => {
        if (err) {
          reject(err);
          return;
        }

        const CHUNK_SIZE = 64 * 1024;
        let offset = 0;

        const writeNext = () => {
          if (offset >= totalBytes) {
            session.sftp.close(handle, (closeErr) => {
              if (closeErr) reject(closeErr);
              else resolve();
            });
            return;
          }

          const end = Math.min(offset + CHUNK_SIZE, totalBytes);
          const chunk = data.slice(offset, end);

          session.sftp.write(handle, chunk, 0, chunk.length, offset, ((writeErr: any, bytesWritten: any) => {
            if (writeErr) {
              session.sftp.close(handle, () => {});
              reject(writeErr);
              return;
            }
            offset += bytesWritten;
            onProgress?.(offset, totalBytes);
            writeNext();
          }) as any);
        };

        writeNext();
      });
    });
  }

  private modeToPermissions(mode: number, isDirectory: boolean): string {
    const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const owner = perms[(mode >> 6) & 7];
    const group = perms[(mode >> 3) & 7];
    const other = perms[mode & 7];
    return (isDirectory ? 'd' : '-') + owner + group + other;
  }

  private evictOldest(): void {
    let oldest: SFTPSession | null = null;
    for (const session of this.sessions.values()) {
      if (!oldest || session.lastUsed < oldest.lastUsed) {
        oldest = session;
      }
    }
    if (oldest) {
      try { oldest.sftp.end(); } catch {}
      try { oldest.client.end(); } catch {}
      this.sessions.delete(oldest.hostId);
    }
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();
    for (const [hostId, session] of this.sessions.entries()) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        try { session.sftp.end(); } catch {}
        try { session.client.end(); } catch {}
        this.sessions.delete(hostId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const session of this.sessions.values()) {
      try { session.sftp.end(); } catch {}
      try { session.client.end(); } catch {}
    }
    this.sessions.clear();
  }
}

export const sftpService = new SFTPServiceImpl();
