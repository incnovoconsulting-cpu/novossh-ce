import { useState } from 'react';
import { FolderOpen } from '@/lib/icons';
import { useStore } from '../../lib/store';
import { useSFTP } from '../../hooks/useSFTP';
import SFTPToolbar from '../SFTP/SFTPToolbar';
import SFTPFileList from '../SFTP/SFTPFileList';
import SFTPBreadcrumb from '../SFTP/SFTPBreadcrumb';
import SFTPTransferProgress from '../SFTP/SFTPTransferProgress';
import SFTPStatusBar from '../SFTP/SFTPStatusBar';
import { PaywallGate } from '../PaywallGate';

export function SFTPView() {
  const hosts = useStore((s) => s.hosts);
  const sftp = useSFTP();
  const [selectedHostId, setSelectedHostId] = useState<string>(hosts[0]?.id ?? '');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: any } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleConnect = async () => {
    if (!selectedHostId) return;
    if (sftp.connected) {
      await sftp.disconnect(selectedHostId);
    } else {
      await sftp.connect(selectedHostId);
    }
  };

  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      await sftp.upload(file);
    }
  };

  const handleDownload = () => {
    if (sftp.selectedFiles.length === 1 && !sftp.selectedFiles[0].isDirectory) {
      sftp.download(sftp.selectedFiles[0]);
    }
  };

  const handleDelete = async () => {
    if (sftp.selectedFiles.length === 0) return;
    const confirmed = window.confirm(`Delete ${sftp.selectedFiles.length} item(s)?`);
    if (!confirmed) return;
    await sftp.deleteFiles(sftp.selectedFiles);
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    await sftp.createFolder(name);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await sftp.rename(renameTarget, renameValue.trim());
    setRenameTarget(null);
  };

  const handleContextMenu = (e: React.MouseEvent, file: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const activeTransfers = sftp.transfers.filter((t) => t.status === 'in-progress' || t.status === 'pending');

  return (
    <PaywallGate feature="sftpBrowser">
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">SFTP browser</h1>
          <p className="text-sm text-slate-400">Browse and transfer files via SFTP.</p>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="label">Host</label>
            <select
              className="input"
              value={selectedHostId}
              onChange={(e) => setSelectedHostId(e.target.value)}
              disabled={sftp.connected}
            >
              <option value="">Select a host</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label} ({h.username}@{h.address}:{h.port})
                </option>
              ))}
            </select>
          </div>
          <div className="pt-5">
            <button
              onClick={handleConnect}
              className="btn-primary"
              disabled={!selectedHostId}
            >
              {sftp.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </section>

      {sftp.connected && (
        <section className="mt-4 rounded-lg border border-white/[0.04] bg-ink-800 overflow-hidden">
          <SFTPToolbar
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onCreateFolder={handleCreateFolder}
            onRefresh={sftp.refresh}
            onToggleHidden={sftp.toggleHidden}
            currentPath={sftp.currentPath}
            onPathNavigate={sftp.navigateTo}
            isConnected={sftp.connected}
            loading={sftp.loading}
            canDelete={sftp.selectedFiles.length > 0}
            canDownload={sftp.selectedFiles.length === 1 && !sftp.selectedFiles[0].isDirectory}
          />

          <SFTPBreadcrumb
            path={sftp.currentPath}
            onNavigate={sftp.navigateTo}
          />

          <div className="min-h-[400px] max-h-[600px] overflow-auto">
            {sftp.loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-sm text-slate-400">Loading...</div>
              </div>
            ) : sftp.error ? (
              <div className="m-4 rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                {sftp.error}
              </div>
            ) : (
              <SFTPFileList
                files={sftp.files}
                selectedFiles={sftp.selectedFiles}
                sortField={sftp.sortField}
                sortDir={sftp.sortDir}
                onSelectFile={sftp.selectFile}
                onDoubleClick={(file) => {
                  if (file.isDirectory) sftp.navigateTo(file.path);
                }}
                onContextMenu={handleContextMenu}
                renameTarget={renameTarget}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRename}
                onRenameCancel={() => setRenameTarget(null)}
              />
            )}
          </div>

          {activeTransfers.length > 0 && (
            <SFTPTransferProgress
              transfers={activeTransfers}
              onCancel={sftp.cancelTransfer}
            />
          )}

          <SFTPStatusBar
            currentPath={sftp.currentPath}
            fileCount={sftp.files.length}
            selectedCount={sftp.selectedFiles.length}
            isConnected={sftp.connected}
          />
        </section>
      )}

      {!sftp.connected && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-lg text-slate-400 font-medium mb-1">Not connected</h2>
          <p className="text-sm text-slate-500">Select a host and click Connect to browse files</p>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg border border-white/10 bg-ink-900 py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {!contextMenu.file.isDirectory && (
            <button
              className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
              onClick={() => { sftp.download(contextMenu.file); setContextMenu(null); }}
            >
              Download
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
            onClick={() => {
              setRenameTarget(contextMenu.file.path);
              setRenameValue(contextMenu.file.name);
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5"
            onClick={async () => {
              await sftp.deleteFiles([contextMenu.file]);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
    </PaywallGate>
  );
}
