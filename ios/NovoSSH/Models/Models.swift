import Foundation

enum AuthMethod: String, Codable, CaseIterable, Identifiable {
    case password, key, agent, cert
    var id: String { rawValue }
    var label: String {
        switch self {
        case .password: return "Password"
        case .key: return "Private key"
        case .agent: return "SSH agent"
        case .cert: return "Certificate"
        }
    }
}

struct Host: Identifiable, Codable, Hashable {
    var id: UUID
    var label: String
    var address: String
    var port: Int
    var username: String
    var authMethod: AuthMethod
    var password: String?
    var keyId: UUID?
    var passphrase: String?
    var certificate: String?
    var tags: [String]
    var colorHex: String?
    var notes: String?
    var connectionMode: SSHConnectionMode?
    var lastConnectedAt: Date?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        label: String,
        address: String,
        port: Int = 22,
        username: String,
        authMethod: AuthMethod = .password,
        password: String? = nil,
        keyId: UUID? = nil,
        passphrase: String? = nil,
        certificate: String? = nil,
        tags: [String] = [],
        colorHex: String? = nil,
        notes: String? = nil,
        connectionMode: SSHConnectionMode? = nil,
        lastConnectedAt: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id; self.label = label; self.address = address
        self.port = port; self.username = username; self.authMethod = authMethod
        self.password = password; self.keyId = keyId; self.passphrase = passphrase
        self.certificate = certificate
        self.tags = tags; self.colorHex = colorHex; self.notes = notes
        self.connectionMode = connectionMode; self.lastConnectedAt = lastConnectedAt
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}

struct IdentityKey: Identifiable, Codable, Hashable {
    var id: UUID
    var label: String
    var privateKey: String
    var publicKey: String?
    var hasPassphrase: Bool
    var createdAt: Date

    init(id: UUID = UUID(), label: String, privateKey: String,
         publicKey: String? = nil, hasPassphrase: Bool = false,
         createdAt: Date = Date()) {
        self.id = id; self.label = label; self.privateKey = privateKey
        self.publicKey = publicKey; self.hasPassphrase = hasPassphrase
        self.createdAt = createdAt
    }
}

struct Snippet: Identifiable, Codable, Hashable {
    var id: UUID
    var label: String
    var command: String
    var description: String?
    var tags: [String]
    var createdAt: Date

    init(id: UUID = UUID(), label: String, command: String,
         description: String? = nil, tags: [String] = [], createdAt: Date = Date()) {
        self.id = id; self.label = label; self.command = command
        self.description = description; self.tags = tags; self.createdAt = createdAt
    }
}

struct PortForwarding: Identifiable, Codable, Hashable {
    var id: UUID
    var hostId: UUID
    var label: String
    var type: ForwardingType
    var localPort: Int
    var remoteHost: String
    var remotePort: Int
    var status: ForwardingStatus = .inactive
    var createdAt: Date

    init(
        id: UUID = UUID(),
        hostId: UUID,
        label: String,
        type: ForwardingType = .local,
        localPort: Int,
        remoteHost: String,
        remotePort: Int,
        status: ForwardingStatus = .inactive,
        createdAt: Date = Date()
    ) {
        self.id = id; self.hostId = hostId; self.label = label
        self.type = type; self.localPort = localPort; self.remoteHost = remoteHost
        self.remotePort = remotePort; self.status = status; self.createdAt = createdAt
    }
}

enum ForwardingType: String, Codable, CaseIterable, Identifiable {
    case local, remote
    var id: String { rawValue }
    var label: String {
        switch self {
        case .local: return "Local Forward"
        case .remote: return "Remote Forward"
        }
    }
    var description: String {
        switch self {
        case .local: return "Forward local port to remote host"
        case .remote: return "Accept connections on remote host forwarded to local"
        }
    }
}

enum ForwardingStatus: String, Codable {
    case inactive, connecting, active, failed
}

struct SFTPFile: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var path: String
    var isDirectory: Bool
    var size: Int64
    var modified: Date
    var permissions: String?
    var owner: String?
    var group: String?

    init(
        name: String,
        path: String,
        isDirectory: Bool,
        size: Int64 = 0,
        modified: Date = Date(),
        permissions: String? = nil,
        owner: String? = nil,
        group: String? = nil
    ) {
        self.name = name
        self.path = path
        self.isDirectory = isDirectory
        self.size = size
        self.modified = modified
        self.permissions = permissions
        self.owner = owner
        self.group = group
        self.id = path
    }

    var icon: String {
        if isDirectory { return "folder.fill" }
        let ext = (name as NSString).pathExtension.lowercased()
        switch ext {
        case "pdf": return "doc.pdf"
        case "txt", "md", "log": return "doc.text"
        case "zip", "tar", "gz": return "doc.zipper"
        case "jpg", "jpeg", "png", "gif": return "photo"
        case "mp3", "wav", "m4a": return "music.note"
        case "mp4", "mov": return "film"
        default: return "doc"
        }
    }

    var sizeFormatted: String {
        let formatter = ByteCountFormatter()
        return formatter.string(fromByteCount: size)
    }
}

struct SFTPBrowserState: Codable, Hashable {
    var hostId: UUID
    var currentPath: String = "/"
    var isLoading: Bool = false
    var error: String?
    var canGoUp: Bool { currentPath != "/" }
    var parentPath: String {
        let path = NSString(string: currentPath)
        let parent = path.deletingLastPathComponent
        return parent.isEmpty ? "/" : parent
    }
}

struct UserSettings: Codable, Hashable {
    var themeId: String = TerminalPalette.novoDark.id
    var fontSize: Int = 13
    var fontFamily: String = "Monospace"
    var cursorBlink: Bool = true
    var copyOnSelect: Bool = true
    var scrollback: Int = 5000
    var keepAliveSeconds: Int = 30
    var bellSound: Bool = false
    var hasSeenOnboarding: Bool = false
    var keyboardButtons: String = "Tab,Esc,^C,^D,^Z,↑,↓,←,→,Home,End,PgUp,PgDn,|,/,~,-"
    var sendOnEnter: Bool = true
}

struct Vault: Identifiable, Codable, Hashable {
    var id: UUID
    var name: String
    var description: String?
    var createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), name: String, description: String? = nil,
         createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id; self.name = name; self.description = description
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}

struct VaultEntry: Identifiable, Codable, Hashable {
    var id: UUID
    var vaultId: UUID
    var type: String   // HOST, CREDENTIAL, KEY, NOTE
    var name: String
    var encryptedData: String
    var createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), vaultId: UUID, type: String, name: String,
         encryptedData: String = "{}", createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id; self.vaultId = vaultId; self.type = type
        self.name = name; self.encryptedData = encryptedData
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    var icon: String {
        switch type {
        case "HOST": return "desktopcomputer"
        case "CREDENTIAL": return "lock.fill"
        case "KEY": return "key.fill"
        default: return "doc.text"
        }
    }
}

struct SessionLog: Identifiable, Codable, Hashable {
    var id: UUID
    var hostId: UUID
    var hostLabel: String
    var startedAt: Date
    var endedAt: Date?
    var commandCount: Int
    var bookmarked: Bool
    var bookmarkComment: String?

    init(id: UUID = UUID(), hostId: UUID, hostLabel: String,
         startedAt: Date = Date(), endedAt: Date? = nil,
         commandCount: Int = 0, bookmarked: Bool = false,
         bookmarkComment: String? = nil) {
        self.id = id; self.hostId = hostId; self.hostLabel = hostLabel
        self.startedAt = startedAt; self.endedAt = endedAt
        self.commandCount = commandCount; self.bookmarked = bookmarked
        self.bookmarkComment = bookmarkComment
    }
}
