import SwiftUI

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

public enum ClipboardHelper {
    public static var string: String? {
        #if os(iOS)
        return UIPasteboard.general.string
        #elseif os(macOS)
        return NSPasteboard.general.string(forType: .string)
        #endif
    }
    public static func setString(_ s: String) {
        #if os(iOS)
        UIPasteboard.general.string = s
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(s, forType: .string)
        #endif
    }
}

public enum AppOpenHelper {
    public static func open(_ url: URL) {
        #if os(iOS)
        Task { @MainActor in
            UIApplication.shared.open(url)
        }
        #elseif os(macOS)
        DispatchQueue.main.async {
            NSWorkspace.shared.open(url)
        }
        #endif
    }
}
