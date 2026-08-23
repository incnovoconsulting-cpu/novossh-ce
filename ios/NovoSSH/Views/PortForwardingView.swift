import SwiftUI

struct PortForwardingView: View {
    @EnvironmentObject private var store: AppStore
    let host: Host
    @State private var forwards: [PortForwarding] = []
    @State private var showAddSheet = false
    @State private var editingForward: PortForwarding?

    var body: some View {
        NavigationStack {
            List {
                if forwards.isEmpty {
                    ContentUnavailableView(
                        "No port forwards",
                        systemImage: "network",
                        description: Text("Add a port forward to tunnel traffic through this SSH connection.")
                    )
                } else {
                    ForEach(forwards) { forward in
                        PortForwardRow(forward: forward) {
                            editingForward = forward
                        } deleteAction: {
                            forwards.removeAll { $0.id == forward.id }
                            store.deletePortForward(forward)
                        }
                    }
                }
            }
            .navigationTitle("Port forwarding")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: { showAddSheet = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddSheet) {
                AddPortForwardSheet(hostId: host.id, isPresented: $showAddSheet) { forward in
                    forwards.append(forward)
                    store.addPortForward(forward)
                }
            }
            .sheet(item: $editingForward) { forward in
                EditPortForwardSheet(
                    forward: forward,
                    isPresented: Binding(
                        get: { editingForward != nil },
                        set: { if !$0 { editingForward = nil } }
                    )
                ) { updated in
                    if let idx = forwards.firstIndex(where: { $0.id == updated.id }) {
                        forwards[idx] = updated
                        store.updatePortForward(updated)
                    }
                }
            }
        }
        .onAppear {
            forwards = store.portForwards.filter { $0.hostId == host.id }
        }
    }
}

struct PortForwardRow: View {
    let forward: PortForwarding
    let editAction: () -> Void
    let deleteAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(forward.label)
                        .font(.headline)
                    Text(forward.type.label)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                statusBadge
            }

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Local: \(forward.localPort)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text("Remote: \(forward.remoteHost):\(forward.remotePort)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }

            HStack(spacing: 12) {
                Button(action: editAction) {
                    Label("Edit", systemImage: "pencil")
                        .font(.caption)
                }
                .buttonStyle(.bordered)

                Spacer()

                Button(action: deleteAction) {
                    Label("Delete", systemImage: "trash")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(Theme.danger)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch forward.status {
        case .active:
            Label("Active", systemImage: "checkmark.circle.fill")
                .font(.caption)
                .foregroundStyle(Theme.success)
        case .connecting:
            HStack(spacing: 4) {
                ProgressView()
                    .scaleEffect(0.8)
                    .tint(Theme.warning)
                Text("Connecting")
                    .font(.caption)
                    .foregroundStyle(Theme.warning)
            }
        case .failed:
            Label("Failed", systemImage: "xmark.circle.fill")
                .font(.caption)
                .foregroundStyle(Theme.danger)
        case .inactive:
            Label("Inactive", systemImage: "circle")
                .font(.caption)
                .foregroundStyle(Theme.textFaint)
        }
    }
}

struct AddPortForwardSheet: View {
    let hostId: UUID
    @Binding var isPresented: Bool
    let onAdd: (PortForwarding) -> Void

    @State private var label = ""
    @State private var type: ForwardingType = .local
    @State private var localPort = 8000
    @State private var remoteHost = ""
    @State private var remotePort = 22

    var isValid: Bool {
        !label.isEmpty && !remoteHost.isEmpty && localPort > 0 && remotePort > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Port forward name", text: $label)

                    Picker("Type", selection: $type) {
                        ForEach(ForwardingType.allCases) { t in
                            Text(t.label).tag(t)
                        }
                    }
                    Text(type.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Section("Local") {
                    Stepper("Port: \(localPort)", value: $localPort, in: 1024...65535)
                }

                Section("Remote") {
                    TextField("Host", text: $remoteHost)
                    Stepper("Port: \(remotePort)", value: $remotePort, in: 1...65535)
                }
            }
            .navigationTitle("Add port forward")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let forward = PortForwarding(
                            hostId: hostId,
                            label: label,
                            type: type,
                            localPort: localPort,
                            remoteHost: remoteHost,
                            remotePort: remotePort
                        )
                        onAdd(forward)
                        isPresented = false
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}

struct EditPortForwardSheet: View {
    var forward: PortForwarding
    @Binding var isPresented: Bool
    let onUpdate: (PortForwarding) -> Void

    @State private var label: String
    @State private var type: ForwardingType
    @State private var localPort: Int
    @State private var remoteHost: String
    @State private var remotePort: Int

    init(forward: PortForwarding, isPresented: Binding<Bool>, onUpdate: @escaping (PortForwarding) -> Void) {
        self.forward = forward
        self._isPresented = isPresented
        self.onUpdate = onUpdate
        _label = State(initialValue: forward.label)
        _type = State(initialValue: forward.type)
        _localPort = State(initialValue: forward.localPort)
        _remoteHost = State(initialValue: forward.remoteHost)
        _remotePort = State(initialValue: forward.remotePort)
    }

    var isValid: Bool {
        !label.isEmpty && !remoteHost.isEmpty && localPort > 0 && remotePort > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Port forward name", text: $label)

                    Picker("Type", selection: $type) {
                        ForEach(ForwardingType.allCases) { t in
                            Text(t.label).tag(t)
                        }
                    }
                }

                Section("Local") {
                    Stepper("Port: \(localPort)", value: $localPort, in: 1024...65535)
                }

                Section("Remote") {
                    TextField("Host", text: $remoteHost)
                    Stepper("Port: \(remotePort)", value: $remotePort, in: 1...65535)
                }
            }
            .navigationTitle("Edit port forward")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Update") {
                        var updated = forward
                        updated.label = label
                        updated.type = type
                        updated.localPort = localPort
                        updated.remoteHost = remoteHost
                        updated.remotePort = remotePort
                        onUpdate(updated)
                        isPresented = false
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}

#Preview {
    PortForwardingView(host: Host(
        label: "Dev Server",
        address: "192.168.1.100",
        username: "root"
    ))
    .environmentObject(AppStore())
}
