// build.gradle.kts (Module :app)
// Phase 1 — minimal Android config + 3 product flavors (dev/staging/prod).
// Phase 2 will add Firebase + Agora deps.

plugins {
    id("com.android.application")
    id("kotlin-android")
    // Phase 2: id("com.google.gms.google-services")
    // Phase 2: id("com.google.firebase.crashlytics")
    // Phase 4: id("io.agora.agorartc")
}

android {
    namespace = "com.randchat.app"
    compileSdk = 34
    ndkVersion = "26.1.10909125"

    defaultConfig {
        applicationId = "com.randchat.app"
        minSdk = 26            // Android 8.0+
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    // ─── Product flavors ───────────────────────────────────────────────
    // dev:     debug-only, separate app id so dev+prod coexist on device.
    // staging: pre-prod; uses prod-like config but with debuggable true.
    // prod:    release-only; minified + shrunk.
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            resValue("string", "app_name", "RandChat Dev")
            buildConfigField("String", "FLAVOR_NAME", "\"dev\"")
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000/api\"")
            buildConfigField("String", "SOCKET_IO_URL", "\"http://10.0.2.2:3000\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            resValue("string", "app_name", "RandChat Staging")
            buildConfigField("String", "FLAVOR_NAME", "\"staging\"")
            buildConfigField("String", "API_BASE_URL", "\"https://staging-api.randchat.example.com/api\"")
            buildConfigField("String", "SOCKET_IO_URL", "\"https://staging-api.randchat.example.com\"")
        }
        create("prod") {
            dimension = "environment"
            resValue("string", "app_name", "RandChat")
            buildConfigField("String", "FLAVOR_NAME", "\"prod\"")
            buildConfigField("String", "API_BASE_URL", "\"https://api.randchat.example.com/api\"")
            buildConfigField("String", "SOCKET_IO_URL", "\"https://api.randchat.example.com\"")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            isDebuggable = true
            // Debug build uses dev flavor by default; can override with
            //   ./gradlew assembleStagingDebug
            //   ./gradlew assembleProdDebug
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Phase 1 placeholder — replace before release with proper keystore.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Phase 2 will add:
    //   implementation("com.google.firebase:firebase-auth")
    //   implementation("com.google.android.gms:play-services-auth")
    // Phase 4 will add:
    //   implementation("io.agora.rtc:full-rtc-sdk:4.x")
    // Phase 6 will add:
    //   implementation("com.android.billingclient:billing:7.x")
}
