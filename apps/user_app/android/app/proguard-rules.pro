# ProGuard/R8 rules for RandChat user_app.
# Applied to release builds only (debug builds skip R8).
# keep_classes: prevents R8 from renaming/removing classes that are
# accessed via reflection (JNI, serialization, annotation processors).

# ─── Flutter ─────────────────────────────────────────────────────────────
-dontwarn io.flutter.**
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }

# ─── Agora RTC SDK (Phase 4) ─────────────────────────────────────────────
# Agora uses JNI for native video/audio codecs — class names must not be obfuscated.
-keep class io.agora.** { *; }
-keep class io.agora.rtc.** { *; }
-keep class io.agora.rtc.internal.** { *; }
-keep class io.agora.rtc.video.** { *; }
-dontwarn io.agora.**

# ─── Google Play Billing (Phase 6) ───────────────────────────────────────
# Billing client uses AIDL + reflection for service binding.
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# ─── Firebase Auth + Analytics + Crashlytics (Phase 2/12) ────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── in_app_purchase (Phase 6) ──────────────────────────────────────────
-keep class io.flutter.plugins.inapppurchase.** { *; }

# ─── Dio (network) ──────────────────────────────────────────────────────
# Dio doesn't strictly need keep rules, but SSL pinning + reflection can break.
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ─── Socket.IO client (Phase 3) ─────────────────────────────────────────
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# ─── JSON serialization (json_serializable / freezed) ───────────────────
# Generated *.g.dart files use reflection — keep them.
-keep class **.generated.** { *; }
-keep class **.g.dart { *; }
-keep class **.freezed.dart { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# ─── permission_handler (Phase 4) ──────────────────────────────────────
-keep class com.baseflow.** { *; }
-dontwarn com.baseflow.**

# ─── wakelock_plus (Phase 4) ────────────────────────────────────────────
-keep class dev.fluttercommunity.** { *; }
-dontwarn dev.fluttercommunity.**

# ─── url_launcher (Phase 9) ─────────────────────────────────────────────
-keep class io.flutter.plugins.urllauncher.** { *; }

# ─── General safety ──────────────────────────────────────────────────────
# Keep enum values (used by Prisma-generated types + our own DTOs).
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable creators.
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}
