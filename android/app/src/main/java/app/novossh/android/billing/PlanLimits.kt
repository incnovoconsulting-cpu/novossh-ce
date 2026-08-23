package app.novossh.android.billing

// Mirrors server PLAN_LIMITS. Keep in sync with server/services/SubscriptionService.ts
data class PlanLimits(
    val hosts: Int,
    val snippets: Int,
    val vaults: Int,
    val keys: Int,
    val tabs: Int,
    val portForwarding: Boolean,
    val sftpBrowser: Boolean,
    val commandPalette: Boolean,
    val mfa: Boolean,
    val analytics: Boolean,
    val p2pSync: Boolean,
    val sessionRecording: Boolean,
    val auditLogs: Boolean,
    val teams: Boolean,
)

val PLAN_LIMITS = mapOf(
    "free" to PlanLimits(
        hosts = 3, snippets = 10, vaults = 1, keys = 2, tabs = 2,
        portForwarding = false, sftpBrowser = false, commandPalette = false,
        mfa = false, analytics = false, p2pSync = false,
        sessionRecording = false, auditLogs = false, teams = false,
    ),
    "starter" to PlanLimits(
        hosts = 25, snippets = Int.MAX_VALUE, vaults = Int.MAX_VALUE, keys = Int.MAX_VALUE, tabs = 10,
        portForwarding = true, sftpBrowser = true, commandPalette = true,
        mfa = true, analytics = true, p2pSync = false,
        sessionRecording = false, auditLogs = false, teams = false,
    ),
    "pro" to PlanLimits(
        hosts = Int.MAX_VALUE, snippets = Int.MAX_VALUE, vaults = Int.MAX_VALUE,
        keys = Int.MAX_VALUE, tabs = Int.MAX_VALUE,
        portForwarding = true, sftpBrowser = true, commandPalette = true,
        mfa = true, analytics = true, p2pSync = true,
        sessionRecording = true, auditLogs = true, teams = true,
    ),
)

fun limitsFor(plan: String): PlanLimits = PLAN_LIMITS[plan] ?: PLAN_LIMITS["free"]!!

// Feature enum for paywall gating
enum class Feature {
    PORT_FORWARDING,
    SFTP_BROWSER,
    COMMAND_PALETTE,
    MFA,
    ANALYTICS,
    P2P_SYNC,
    SESSION_RECORDING,
    AUDIT_LOGS,
    TEAMS,
    UNLIMITED_HOSTS,
    UNLIMITED_VAULTS,
    UNLIMITED_KEYS,
    UNLIMITED_TABS,
}

fun PlanLimits.hasFeature(feature: Feature): Boolean = when (feature) {
    Feature.PORT_FORWARDING  -> portForwarding
    Feature.SFTP_BROWSER     -> sftpBrowser
    Feature.COMMAND_PALETTE  -> commandPalette
    Feature.MFA              -> mfa
    Feature.ANALYTICS        -> analytics
    Feature.P2P_SYNC         -> p2pSync
    Feature.SESSION_RECORDING -> sessionRecording
    Feature.AUDIT_LOGS       -> auditLogs
    Feature.TEAMS            -> teams
    Feature.UNLIMITED_HOSTS  -> hosts == Int.MAX_VALUE
    Feature.UNLIMITED_VAULTS -> vaults == Int.MAX_VALUE
    Feature.UNLIMITED_KEYS   -> keys == Int.MAX_VALUE
    Feature.UNLIMITED_TABS   -> tabs == Int.MAX_VALUE
}

fun canAccess(plan: String, feature: Feature): Boolean =
    limitsFor(plan).hasFeature(feature)

fun requiredPlanFor(feature: Feature): String = when (feature) {
    Feature.PORT_FORWARDING, Feature.SFTP_BROWSER, Feature.COMMAND_PALETTE,
    Feature.MFA, Feature.ANALYTICS -> "starter"
    Feature.P2P_SYNC, Feature.SESSION_RECORDING, Feature.AUDIT_LOGS, Feature.TEAMS,
    Feature.UNLIMITED_HOSTS, Feature.UNLIMITED_VAULTS, Feature.UNLIMITED_KEYS,
    Feature.UNLIMITED_TABS -> "pro"
}
