import Foundation

/// Network address classification for iOS SSH connections
struct NetworkClassifier {
  static func isPrivateIPRange(_ address: String) -> Bool {
    let ipv4Pattern = "^(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)$"
    let isIPv4Literal: Bool = {
      guard let regex = try? NSRegularExpression(pattern: ipv4Pattern) else { return false }
      let nsAddress = address as NSString
      return regex.firstMatch(in: address, range: NSRange(location: 0, length: nsAddress.length)) != nil
    }()

    if isIPv4Literal {
      let components = address.split(separator: ".").compactMap { Int($0) }
      guard components.count == 4 else { return false }

      let (a, b) = (components[0], components[1])

      // 10.0.0.0/8
      if a == 10 { return true }

      // 172.16.0.0/12
      if a == 172 && b >= 16 && b <= 31 { return true }

      // 192.168.0.0/16
      if a == 192 && b == 168 { return true }

      // 127.0.0.0/8 (loopback)
      if a == 127 { return true }

      // 169.254.0.0/16 (link-local)
      if a == 169 && b == 254 { return true }
    }

    // IPv6 loopback
    if address == "::1" || address == "::" { return true }

    // fc00::/7 (Unique Local Address)
    let lowered = address.lowercased()
    if lowered.hasPrefix("fc") || lowered.hasPrefix("fd") { return true }

    // fe80::/10 (Link-local)
    if lowered.hasPrefix("fe8") || lowered.hasPrefix("fe9") ||
       lowered.hasPrefix("fea") || lowered.hasPrefix("feb") { return true }

    // ::ffff:10.x.x.x (IPv4-mapped private)
    if lowered.hasPrefix("::ffff:") {
      let mapped = String(lowered.dropFirst(7))
      let mappedComponents = mapped.split(separator: ".").compactMap { Int($0) }
      if mappedComponents.count == 4 {
        let (a, b) = (mappedComponents[0], mappedComponents[1])
        if a == 10 { return true }
        if a == 172 && b >= 16 && b <= 31 { return true }
        if a == 192 && b == 168 { return true }
        if a == 127 { return true }
      }
    }

    return false
  }

  static func isTailscaleIP(_ address: String) -> Bool {
    // Tailscale IPv4: 100.x.x.x
    if address.starts(with: "100.") {
      let pattern = "^100\\.\\d+\\.\\d+\\.\\d+$"
      return address.range(of: pattern, options: .regularExpression) != nil
    }

    // Tailscale hostname: *.ts.net
    if address.hasSuffix(".ts.net") { return true }

    // Tailscale IPv6: fd7a:115c:...
    if address.starts(with: "fd7a:115c:") { return true }

    return false
  }
}

/// SSH connection mode determination
enum SSHConnectionMode: String, Codable {
  case direct
  case tailscale
  case relay
}

/// Routes SSH connections based on host network reachability
@MainActor
final class DirectSSHConnectionManager: ObservableObject {

  /// Determines how to route a connection based on host address and requested mode
  static func determineConnectionMode(
    hostAddress: String,
    requestedMode: SSHConnectionMode?
  ) -> SSHConnectionMode {
    let isTailscale = NetworkClassifier.isTailscaleIP(hostAddress)

    switch requestedMode {
    case .direct:
      // An explicit direct request is trusted as-is for a plain private LAN address: the
      // relay (a cloud server) has no route to a LAN IP that isn't Headscale-enrolled, so
      // forcing relay there would make local-network hosts unreachable — the client is on
      // the LAN (or not) and is best positioned to judge that reachability.
      //
      // A Tailscale address (100.x.x.x / *.ts.net) is the opposite case: iOS has no local
      // Tailscale/WireGuard interface here (this app doesn't run its own tunnel), so a raw
      // direct TCP connect to a Tailscale IP has no route and always fails. The backend
      // relay, which does have Headscale mesh connectivity (see HeadscaleService server
      // side), can actually reach it — so route Tailscale addresses through the relay even
      // when direct was requested/defaulted to.
      if isTailscale { return .relay }
      return .direct

    case .tailscale:
      // Tailscale mode: only for Tailscale addresses
      if isTailscale {
        return .tailscale
      }
      return .direct

    case .relay, .none:
      // Relay mode: always routes through backend
      return .relay
    }
  }

  /// Resolves actual host and port based on connection mode
  static func resolveTarget(
    hostAddress: String,
    hostPort: UInt16,
    connectionMode: SSHConnectionMode,
    tailscaleIP: String? = nil
  ) -> (host: String, port: UInt16) {
    switch connectionMode {
    case .tailscale:
      // Connect directly via Tailscale IP (P2P, no relay)
      if let tsIP = tailscaleIP, !tsIP.isEmpty {
        return (host: tsIP, port: hostPort)
      }
      // Fallback: route through local Tailscale reverse tunnel
      return (host: "127.0.0.1", port: 2222)
    case .direct:
      // Direct connection to specified address/port
      return (host: hostAddress, port: hostPort)
    case .relay:
      // Would go through backend relay (not used in native client)
      return (host: hostAddress, port: hostPort)
    }
  }
}
