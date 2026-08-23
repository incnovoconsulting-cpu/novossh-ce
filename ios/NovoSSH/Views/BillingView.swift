import SwiftUI
import StoreKit

struct BillingView: View {
    @ObservedObject private var service = BillingService.shared
    @ObservedObject private var storeKit = StoreKitService.shared
    @State private var showManageSubscriptions = false
    @State private var displayedProducts: [Product] = []

    // Feature/limitation copy shown in each subscription's marketing content. Pricing is
    // no longer hardcoded here — SubscriptionStoreView renders the real, StoreKit-sourced
    // price for each product directly, which is what Guideline 3.1.2(c) requires to be the
    // most prominent element (a calculated/equivalent price must never take its place).
    struct PlanDef {
        let id: String; let name: String
        let features: [String]; let limitations: [String]
    }
    private let plans: [PlanDef] = [
        PlanDef(id: "free", name: "Free",
                features: ["3 hosts", "10 snippets", "1 vault", "2 SSH keys", "2 tabs"],
                limitations: ["No port forwarding", "No SFTP browser", "No MFA"]),
        PlanDef(id: "starter", name: "Starter",
                features: ["25 hosts", "Unlimited snippets, vaults & keys", "10 tabs",
                           "Port forwarding", "SFTP browser", "MFA / security keys",
                           "Analytics", "Command palette"],
                limitations: ["No session recording", "No P2P sync"]),
        PlanDef(id: "pro", name: "Pro",
                features: ["Unlimited hosts & tabs", "Session recording & playback",
                           "Audit logs", "P2P sync", "Priority support", "Everything in Starter"],
                limitations: []),
    ]

    // All four products (two tiers x two durations), in a stable order: Starter monthly,
    // Starter annual, Pro monthly, Pro annual.
    //
    // This is deliberately NOT a computed property over storeKit.products. It was one
    // before (build 74) and still got rejected for the exact same freeze, because a
    // computed property re-sorts and allocates a brand-new array on every SwiftUI body
    // re-evaluation — and BillingView re-renders on ANY @ObservedObject publish,
    // including storeKit.isPurchasing flipping true the instant the user taps to buy.
    // SubscriptionStoreView was being handed a "new" subscriptions array mid-purchase and
    // reinitializing, which is what froze the native Monthly/Annual duration picker and
    // made the purchase unverifiable. Storing the ordered list in @State and populating it
    // only from genuine load/retry/refresh events (never as a byproduct of an unrelated
    // render) keeps the array identity — and therefore SubscriptionStoreView's internal
    // state — stable across taps, purchases, and errors.
    private static func orderedProducts(from products: [Product]) -> [Product] {
        products.sorted { lhs, rhs in
            func rank(_ p: Product) -> Int {
                let tier = p.id.contains(".starter.") ? 0 : 1
                let period = p.id.hasSuffix(".monthly") ? 0 : 1
                return tier * 2 + period
            }
            return rank(lhs) < rank(rhs)
        }
    }

    // Splitting the body into small extracted @ViewBuilder properties (rather than one
    // giant LazyVStack closure) avoids a SwiftUI type-checker timeout ("unable to
    // type-check this expression in reasonable time") that the combined expression
    // triggered — each piece here is small enough to infer quickly on its own.

    @ViewBuilder
    private var currentPlanBanner: some View {
        if service.isLoading && service.subscription == nil {
            ProgressView("Loading billing info…")
                .tint(Theme.accent)
                .padding(.top, 40)
        } else if let sub = service.subscription {
            PlanBanner(subscription: sub, onManage: { showManageSubscriptions = true })
        } else {
            PlanBanner(
                subscription: Subscription(plan: "free", status: "active", usage: nil),
                onManage: nil
            )
        }
    }

    // Informational feature-comparison cards for all three tiers, shown above the native
    // purchase picker. SubscriptionStoreView auto-generates each option's title/description
    // from its App Store Connect configuration but doesn't expose a way to inject a full
    // per-tier feature list (its marketingContent parameter is a single shared view, not
    // one per product) — these cards are how users still see what's included at each tier.
    // Free has no StoreKit product at all, so it's info-only here regardless.
    @ViewBuilder
    private var planFeaturesSection: some View {
        let currentPlan = service.subscription?.plan ?? "free"
        ForEach(plans, id: \.id) { plan in
            PlanFeaturesCard(plan: plan, isCurrent: plan.id == currentPlan)
        }
    }

    // Native subscription purchase UI (Guideline 3.1.2(c)): StoreKit renders each
    // product's real billed price prominently and correctly by construction, and the
    // policy-destination modifiers add the required functional Terms of Use / Privacy
    // Policy links directly in the purchase flow.
    //
    // Guideline 2.1(a) fix: the previous version gated purely on
    // `currentCycleProducts.isEmpty`, which can't tell "still loading" apart from "the
    // fetch finished but returned nothing" — both looked identical: an infinite spinner
    // with no way out (reported as "the app loaded indefinitely at the Subscription
    // page"). storeKit.didLoadProducts (set true when loadProducts() completes, success
    // or failure — see StoreKitService, which now also has a 10s timeout so the
    // underlying fetch itself can't hang forever) lets this show a real error + Retry
    // instead of spinning once loading has actually finished.
    @ViewBuilder
    private var subscriptionPicker: some View {
        if !storeKit.didLoadProducts {
            ProgressView("Loading plans…")
                .tint(Theme.accent)
                .padding(.vertical, 40)
        } else if displayedProducts.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.title2)
                    .foregroundStyle(Theme.textStrong.opacity(0.5))
                Text(storeKit.purchaseError ?? "Plans aren't available right now.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textStrong.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Button("Retry") {
                    Task {
                        await storeKit.loadProducts()
                        displayedProducts = Self.orderedProducts(from: storeKit.products)
                    }
                }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
        } else {
            // Bare initializer (no custom marketingContent/content closure): StoreKit's
            // marketingContent parameter is a single SHARED zero-argument view, not a
            // per-product closure, so it can't render each tier's distinct feature list.
            // Letting SubscriptionStoreView auto-generate each option's title/description
            // from its App Store Connect configuration is the simplest, lowest-risk way to
            // guarantee correct/compliant price + duration display; the rich per-tier
            // feature lists are shown separately in planFeaturesSection above.
            //
            // displayedProducts is @State, set only on load/retry/refresh — see its
            // declaration above for why that stability matters here.
            SubscriptionStoreView(subscriptions: displayedProducts)
                .subscriptionStoreControlStyle(.prominentPicker)
                .storeButton(.visible, for: .restorePurchases)
                .subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
                .subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)
                .onInAppPurchaseCompletion(perform: handlePurchaseCompletion)
                .frame(minHeight: 420)
            // Guideline 3.1.2(c) rejected build 75 for missing functional Terms/Privacy
            // links "within the app" purchase flow, even though
            // subscriptionStorePolicyDestination above is wired to the same live URLs.
            // SubscriptionStoreView's built-in legal footer has documented rendering
            // issues with .prominentPicker (Apple Developer Forums threads 813493,
            // 766337 — links not surfaced, or a policy sheet that renders too wide and
            // can't be dismissed). Rather than depend on that opaque, seemingly-buggy
            // native footer, show our own always-visible links directly — a plain
            // SwiftUI Link can't silently fail to render the way a native subview can.
            legalLinksFooter
        }
    }

    private var legalLinksFooter: some View {
        HStack(spacing: 6) {
            Link("Terms of Use", destination: termsURL)
            Text("•").foregroundStyle(Theme.textStrong.opacity(0.3))
            Link("Privacy Policy", destination: privacyURL)
        }
        .font(.caption)
        .foregroundStyle(Theme.accent)
        .padding(.top, 4)
    }

    private let termsURL = URL(string: "https://novossh.com/terms")!
    private let privacyURL = URL(string: "https://novossh.com/privacy")!

    private func handlePurchaseCompletion(product: Product, result: Result<Product.PurchaseResult, any Error>) {
        if case .failure(let error) = result {
            storeKit.purchaseError = error.localizedDescription
        }
        // Successful purchases are verified and applied via StoreKitService's
        // Transaction.updates listener regardless of whether they were initiated here.
    }

    var body: some View {
        ZStack { Theme.bg.ignoresSafeArea() }
            .overlay {
                ScrollView {
                    LazyVStack(spacing: 20) {
                        currentPlanBanner
                        planFeaturesSection
                        subscriptionPicker
                        if !service.quotas.isEmpty {
                            UsageSection(quotas: service.quotas)
                        }
                    }
                    .padding(.vertical, 16)
                }
            }
            .navigationTitle("Billing & Plans")
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
            .task {
                // Run concurrently, not sequentially: these hit two unrelated backends
                // (our billing API vs. StoreKit), so a slow/timed-out billing fetch must
                // never delay the subscription picker from starting its own — related to
                // the Guideline 2.1(a) "loaded indefinitely" fix in subscriptionPicker.
                async let sub: () = service.fetchAll()
                async let products: () = storeKit.loadProducts()
                _ = await (sub, products)
                displayedProducts = Self.orderedProducts(from: storeKit.products)
            }
            .refreshable {
                async let sub: () = service.fetchAll()
                async let products: () = storeKit.loadProducts()
                _ = await (sub, products)
                displayedProducts = Self.orderedProducts(from: storeKit.products)
            }
            .manageSubscriptionsSheet(isPresented: $showManageSubscriptions)
            .alert("Error", isPresented: .constant(service.error != nil || storeKit.purchaseError != nil),
                   presenting: service.error ?? storeKit.purchaseError) { errorMsg in
                if errorMsg?.contains("Session expired") == true {
                    Button("Sign In") {
                        service.error = nil
                        // Navigate to login - user needs to re-authenticate
                    }
                } else {
                    Button("OK") { service.error = nil; storeKit.purchaseError = nil }
                }
            } message: { Text($0 ?? "") }
    }
}

// MARK: - Current plan banner

private struct PlanBanner: View {
    let subscription: Subscription
    let onManage: (() -> Void)?

    private var planColor: Color {
        switch subscription.plan {
        case "pro": return Color(hex: "#a855f7")
        case "starter": return Theme.accent
        default: return Theme.textStrong.opacity(0.5)
        }
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Current Plan")
                    .font(.caption)
                    .foregroundStyle(Theme.textStrong.opacity(0.5))
                HStack(spacing: 8) {
                    Text(subscription.plan.capitalized)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(planColor)
                    StatusBadge(status: subscription.status)
                }
            }
            Spacer()
            if subscription.plan != "free", let onManage {
                Button("Manage") { onManage() }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
                    .font(.subheadline)
            }
        }
        .padding()
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct StatusBadge: View {
    let status: String
    private var color: Color {
        switch status {
        case "active": return .green
        case "past_due": return .orange
        default: return .red
        }
    }
    var body: some View {
        Text(status.replacingOccurrences(of: "_", with: " "))
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Per-tier feature card (informational; purchase itself happens in SubscriptionStoreView)

private struct PlanFeaturesCard: View {
    let plan: BillingView.PlanDef
    let isCurrent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(plan.name)
                    .font(.headline)
                    .foregroundStyle(Theme.textStrong)
                Spacer()
                if isCurrent {
                    Text("Current")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.textStrong.opacity(0.6))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Theme.textStrong.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
            Divider().background(Theme.stroke)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(plan.features, id: \.self) { f in
                    Label(f, systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textStrong.opacity(0.8))
                        .labelStyle(TightLabelStyle())
                }
                ForEach(plan.limitations, id: \.self) { l in
                    Label(l, systemImage: "xmark.circle")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textStrong.opacity(0.35))
                        .labelStyle(TightLabelStyle())
                }
            }
        }
        .padding()
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct TightLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon.foregroundStyle(Theme.accent)
            configuration.title
        }
    }
}

// MARK: - Usage bars

private struct UsageSection: View {
    let quotas: [QuotaStatus]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Resource Usage", systemImage: "gauge")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textStrong)
                .padding(.horizontal)

            VStack(spacing: 0) {
                ForEach(quotas.sorted(by: { $0.usagePercent > $1.usagePercent })) { quota in
                    UsageRow(quota: quota)
                    if quota.id != quotas.last?.id {
                        Divider().background(Theme.stroke).padding(.horizontal)
                    }
                }
            }
            .background(Theme.panel)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }
}

private struct UsageRow: View {
    let quota: QuotaStatus

    private var barColor: Color {
        switch quota.status {
        case "critical": return .red
        case "warning": return .orange
        default: return Theme.accent
        }
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(quota.resourceType.capitalized)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textStrong)
                Spacer()
                Text("\(quota.currentUsage) / \(quota.hardLimit)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.textStrong.opacity(0.5))
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor.opacity(0.12))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor)
                        .frame(width: geo.size.width * min(CGFloat(quota.usagePercent / 100), 1.0))
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}
