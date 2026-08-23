import SwiftUI

struct SFTPBrowserView: View {
    @EnvironmentObject private var store: AppStore
    let host: Host
    @StateObject private var session = SSHSession()
    @State private var files: [SFTPFile] = []
    @State private var browserState = SFTPBrowserState(hostId: UUID())
    @State private var selectedFile: SFTPFile?
    @State private var showingFileActions = false
    @State private var showingUpload = false
    @State private var showingNewFolder = false
    @State private var newFolderName = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()

                if browserState.isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                        Text("Loading files...")
                            .foregroundColor(.secondary)
                    }
                } else if let error = browserState.error {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 40))
                            .foregroundColor(.red)
                        Text("Error")
                            .font(.headline)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            loadFiles()
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding()
                } else if files.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "folder")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No files")
                            .foregroundColor(.secondary)
                    }
                } else {
                    List(files) { file in
                        SFTPFileRow(file: file) {
                            selectedFile = file
                            if file.isDirectory {
                                browserState.currentPath = file.path
                                loadFiles()
                            } else {
                                showingFileActions = true
                            }
                        }
                        .listRowBackground(Theme.panel)
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle(URL(fileURLWithPath: browserState.currentPath).lastPathComponent.isEmpty ? "SFTP" : URL(fileURLWithPath: browserState.currentPath).lastPathComponent)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button(action: { showingUpload = true }) {
                            Label("Upload", systemImage: "arrow.up.doc")
                        }
                        Button(action: { showingNewFolder = true }) {
                            Label("New Folder", systemImage: "folder.badge.plus")
                        }
                        Divider()
                        if browserState.canGoUp {
                            Button(action: {
                                browserState.currentPath = browserState.parentPath
                                loadFiles()
                            }) {
                                Label("Go Up", systemImage: "arrow.up")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .confirmationDialog(selectedFile?.name ?? "", isPresented: $showingFileActions, titleVisibility: .visible) {
                Button("Download") {
                    if let file = selectedFile { downloadFile(file) }
                }
                Button("Delete", role: .destructive) {
                    if let file = selectedFile { deleteFile(file) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showingNewFolder) {
                NewFolderSheet(name: $newFolderName) {
                    createFolder()
                    showingNewFolder = false
                }
            }
        }
        .onAppear {
            browserState.hostId = host.id
            loadFiles()
        }
    }

    private func loadFiles() {
        browserState.isLoading = true
        browserState.error = nil

        Task {
            do {
                let auth = getAuthMethod()
                var h = host; h.password = auth.password
                await session.connect(host: h, identityKey: auth.key)

                let fileList = try await session.listFiles(path: browserState.currentPath)
                await MainActor.run {
                    self.files = fileList
                    self.browserState.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.browserState.error = error.localizedDescription
                    self.browserState.isLoading = false
                }
            }
        }
    }

    private func downloadFile(_ file: SFTPFile) {
        Task {
            do {
                let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                let fileURL = documentsURL.appendingPathComponent(file.name)
                try await session.downloadFile(remotePath: file.path, localURL: fileURL)
                // File saved to Documents
            } catch {
                browserState.error = "Download failed: \(error.localizedDescription)"
            }
        }
    }

    private func deleteFile(_ file: SFTPFile) {
        Task {
            do {
                try await session.deleteFile(remotePath: file.path)
                loadFiles()
            } catch {
                browserState.error = "Delete failed: \(error.localizedDescription)"
            }
        }
    }

    private func createFolder() {
        guard !newFolderName.isEmpty else { return }
        let folderPath = (browserState.currentPath as NSString).appendingPathComponent(newFolderName)

        Task {
            do {
                try await session.createDirectory(remotePath: folderPath)
                newFolderName = ""
                loadFiles()
            } catch {
                browserState.error = "Create folder failed: \(error.localizedDescription)"
            }
        }
    }

    private func getAuthMethod() -> (password: String?, key: IdentityKey?) {
        let password = store.resolvedPassword(for: host)
        let key = host.keyId.flatMap { store.key(by: $0) }
        return (password, key)
    }
}

struct SFTPFileRow: View {
    let file: SFTPFile
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: file.icon)
                    .font(.system(size: 18))
                    .foregroundColor(file.isDirectory ? .blue : .gray)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 4) {
                    Text(file.name)
                        .font(.body)
                        .foregroundColor(.primary)
                    HStack(spacing: 8) {
                        Text(file.sizeFormatted)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(file.modified.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}

struct NewFolderSheet: View {
    @Binding var name: String
    let onCreate: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Folder Name") {
                    TextField("Name", text: $name)
                }
            }
            .navigationTitle("New Folder")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        onCreate()
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

#Preview {
    SFTPBrowserView(host: Host(
        label: "Dev Server",
        address: "192.168.1.100",
        username: "root"
    ))
    .environmentObject(AppStore())
}
