# NovoSSH ProGuard/R8 Configuration
# Optimizes APK size while maintaining functionality for SSH client

# ============================================================================
# OPTIMIZATION SETTINGS
# ============================================================================

# Enable aggressive optimization passes
-optimizationpasses 5

# Repackage classes into a single package
-repackageclasses 'app.novossh.android.lib'

# Allow access modification for better optimization
-allowaccessmodification

# Use shorter names for class members
-useuniqueclassmembernames

# Verbose output for debugging optimization
# -verbose

# ============================================================================
# NovoSSH APP CODE - Keep all classes (conservative for safety)
# ============================================================================

-keep class app.novossh.android.** { *; }
-keepclassmembers class app.novossh.android.** {
    public static final *;
    public static *;
    public *;
}

# Keep all activities, services, receivers, content providers (entry points)
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.app.Application
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.view.View {
    public <init>(android.content.Context, android.util.AttributeSet);
}

# ============================================================================
# JETPACK & ANDROIDX - Let Gradle plugins handle (minimal overrides)
# ============================================================================

# Compose
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Room
-keep class androidx.room.** { *; }
-dontwarn androidx.room.**

# EncryptedSharedPreferences
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# Google Tink (used by EncryptedSharedPreferences)
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.errorprone.annotations.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**

# DataStore
-keep class androidx.datastore.** { *; }
-dontwarn androidx.datastore.**

# Navigation
-keep class androidx.navigation.** { *; }

# Lifecycle & ViewModel
-keep class androidx.lifecycle.** { *; }
-keep class androidx.activity.viewmodel.** { *; }

# ============================================================================
# JSch SSH Library - Keep all classes (critical for SSH functionality)
-keep class com.jcraft.jsch.** { *; }
-keep class com.github.mwiede.jsch.** { *; }
-keep class org.ietf.jgss.** { *; }
-dontwarn com.jcraft.jsch.**
-dontwarn com.github.mwiede.jsch.**
-dontwarn org.ietf.jgss.**

# ============================================================================
# KOTLIN - Keep Kotlin reflection and coroutines
# ============================================================================

-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# ============================================================================
# ANNOTATIONS - Keep for reflection-based frameworks
# ============================================================================

-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes EnclosingMethod,InnerClasses

# ============================================================================
# REMOVE DEBUGGING INFO (reduce APK size further)
# ============================================================================

# Comment out the next 2 lines if you want full debug info
# -renamesourcefileattribute SourceFile
# -keepattributes SourceFile,LineNumberTable

# ============================================================================
# WARNINGS - Suppress known safe warnings
# ============================================================================

-dontwarn java.**
-dontwarn javax.**
-dontwarn org.xml.**
-dontwarn org.w3c.**
-dontwarn org.apache.**
-dontwarn sun.misc.**

# ============================================================================
# NATIVE METHODS - Keep signatures of native methods
# ============================================================================

-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================================================
# ENUM OPTIMIZATION - Keep enum methods required by reflection
# ============================================================================

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
