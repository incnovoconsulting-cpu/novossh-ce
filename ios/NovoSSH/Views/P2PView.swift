import SwiftUI

struct P2PView: View {
    @StateObject private var service = P2PService.shared
    @State private var peerIdInput = ""
    @State private var sessionNameInput = "Shared Terminal"
    @State private var showConnectSheet = false

    var body: some View {
        ZStack { Theme.bg.ignoresSafeArea() }
            .overlay {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        // Connected state
                        if service.connectionState == .connected, let peer = service.connectedPeerId {
                            ConnectedCard(peerId: peer, onDisconnect: { service.disconnect() })
                            MessagingCard(
                                messages: service.receivedMessages,
                                onSend: { text in service.send(text: text) }
                            )
                        } else {
                            // Status card
                            ConnectionStatusCard(state: service.connectionState)
                        }

                        // Pending incoming offers
                        if !service.pendingMessages.isEmpty {
                            incomingSection
                        }

                        // Connect button
                        if service.connectionState == .idle || service.connectionState == .failed {
                            Button {
                                showConnectSheet = true
                            } label: {
                                Label("Connect to Peer", systemImage: "person.2.wave.2")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Theme.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .foregroundStyle(.black)
                            }
                            .padding(.horizontal)
                        }

                        // Info card about WebRTC
                        InfoCard()
                    }
                    .padding(.vertical, 16)
                }
            }
            .navigationTitle("P2P Sessions")
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if service.isPolling { service.stopPolling() }
                        else { service.startPolling() }
                    } label: {
                        Image(systemName: service.isPolling ? "antenna.radiowaves.left.and.right" : "antenna.radiowaves.left.and.right.slash")
                            .foregroundStyle(service.isPolling ? Theme.accent : Theme.textStrong.opacity(0.4))
                    }
                }
            }
            .task { service.startPolling() }
            .onDisappear { service.stopPolling() }
            .sheet(isPresented: $showConnectSheet) {
                ConnectPeerSheet(
                    peerId: $peerIdInput,
                    sessionName: $sessionNameInput,
                    onConnect: {
                        Task { await service.sendOffer(toPeerId: peerIdInput, sessionName: sessionNameInput) }
                        showConnectSheet = false
                    }
                )
            }
            .alert("Error", isPresented: .constant(service.error != nil), presenting: service.error) { _ in
                Button("OK") { service.error = nil }
            } message: { Text($0) }
    }

    private var incomingSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Incoming Requests", systemImage: "bell.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textStrong)
                .padding(.horizontal)

            ForEach(service.pendingMessages.filter { $0.type == "offer" }) { msg in
                IncomingOfferCard(
                    message: msg,
                    onAccept: { Task { await service.acceptOffer(msg) } },
                    onDecline: { Task { await service.declineOffer(messageId: msg.id) } }
                )
            }
        }
    }
}

// MARK: - Sub-views

private struct ConnectedCard: View {
    let peerId: String
    let onDisconnect: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Circle().fill(Color.green).frame(width: 10, height: 10)
                Text("Connected").font(.subheadline.weight(.semibold)).foregroundStyle(.green)
                Spacer()
                Button("Disconnect", role: .destructive, action: onDisconnect)
                    .font(.subheadline)
            }
            HStack {
                Image(systemName: "person.circle")
                    .font(.largeTitle)
                    .foregroundStyle(Theme.accent)
                VStack(alignment: .leading) {
                    Text("Peer ID").font(.caption).foregroundStyle(Theme.textStrong.opacity(0.5))
                    Text(peerId)
                        .font(.system(.footnote, design: .monospaced))
                        .foregroundStyle(Theme.textStrong)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
        }
        .padding()
        .background(Color.green.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.green.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}

private struct MessagingCard: View {
    let messages: [(fromSelf: Bool, text: String)]
    let onSend: (String) -> Void
    @State private var input = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Data Channel", systemImage: "bolt.horizontal.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.textStrong.opacity(0.6))

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    if messages.isEmpty {
                        Text("Data channel open — send a message to test the live connection.")
                            .font(.caption2)
                            .foregroundStyle(Theme.textStrong.opacity(0.4))
                    }
                    ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                        Text("\(msg.fromSelf ? "You" : "Peer"): \(msg.text)")
                            .font(.caption)
                            .foregroundStyle(msg.fromSelf ? Theme.accent : Theme.textStrong)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 120)

            HStack {
                TextField("Type a message…", text: $input)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    guard !input.isEmpty else { return }
                    onSend(input)
                    input = ""
                }
            }
        }
        .padding()
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct ConnectionStatusCard: View {
    let state: P2PConnectionState

    private var icon: String {
        switch state {
        case .idle: return "wifi.slash"
        case .offering: return "arrow.up.circle"
        case .waitingForAnswer: return "clock.arrow.circlepath"
        case .connected: return "checkmark.circle"
        case .failed: return "exclamationmark.triangle"
        }
    }
    private var label: String {
        switch state {
        case .idle: return "Not connected"
        case .offering: return "Sending offer…"
        case .waitingForAnswer: return "Waiting for peer to accept…"
        case .connected: return "Connected"
        case .failed: return "Connection failed"
        }
    }
    private var color: Color {
        switch state {
        case .failed: return .red
        case .waitingForAnswer, .offering: return .orange
        default: return Theme.textStrong.opacity(0.4)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(color).font(.title2)
            Text(label).foregroundStyle(color).font(.subheadline)
            if state == .waitingForAnswer || state == .offering {
                Spacer()
                ProgressView().tint(color)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct IncomingOfferCard: View {
    let message: P2PSignalMessage
    let onAccept: () -> Void
    let onDecline: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "person.wave.2")
                    .foregroundStyle(Theme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Incoming P2P Request")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textStrong)
                    Text("From: \(message.from)")
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            if let name = message.data.sessionName {
                Label(name, systemImage: "terminal")
                    .font(.caption)
                    .foregroundStyle(Theme.accent)
            }
            HStack(spacing: 8) {
                Button("Accept") { onAccept() }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
                    .foregroundStyle(.black)
                Button("Decline", role: .destructive) { onDecline() }
                    .buttonStyle(.bordered)
                    .tint(.red)
            }
        }
        .padding()
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.accent.opacity(0.25), lineWidth: 1)
        )
        .padding(.horizontal)
    }
}

private struct InfoCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("About P2P Sessions", systemImage: "info.circle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textStrong)
            Text("P2P sessions use WebRTC signaling to establish direct encrypted connections between NovoSSH clients. Enter the User ID of another NovoSSH user to initiate a connection for collaborative terminal access.")
                .font(.caption)
                .foregroundStyle(Theme.textStrong.opacity(0.5))
        }
        .padding()
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

// MARK: - Connect peer sheet

private struct ConnectPeerSheet: View {
    @Binding var peerId: String
    @Binding var sessionName: String
    let onConnect: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Peer") {
                    TextField("User ID or email", text: $peerId)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                Section("Session") {
                    TextField("Session name", text: $sessionName)
                }
                Section {
                    Text("The peer must have NovoSSH open and polling enabled to receive your connection request.")
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Connect to Peer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send Request") {
                        onConnect()
                        dismiss()
                    }
                    .disabled(peerId.isEmpty)
                }
            }
        }
    }
}
