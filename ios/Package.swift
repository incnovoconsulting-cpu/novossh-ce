// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NovoSSH",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "NovoSSH",
            targets: ["NovoSSH"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0"),
        .package(url: "https://github.com/orlandos-nl/Citadel", from: "0.7.0"),
    ],
    targets: [
        .target(
            name: "NovoSSH",
            dependencies: [
                .product(name: "SwiftTerm", package: "SwiftTerm"),
                .product(name: "Citadel", package: "Citadel"),
            ],
            path: "NovoSSH",
            exclude: ["Info.plist"],
            resources: [
                .process("Resources/Assets.xcassets"),
            ],
            linkerSettings: [
                .linkedFramework("LocalAuthentication"),
                .linkedFramework("Security"),
                .linkedFramework("AppKit", .when(platforms: [.macOS])),
                .linkedFramework("UIKit", .when(platforms: [.iOS])),
            ]
        ),
    ]
)
