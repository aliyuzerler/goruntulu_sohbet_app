# RandChat — Device Matrix Test Plan

## Objective

Ensure RandChat works across the Android device ecosystem: Android 8 through 14, various screen sizes, notch/cutout layouts, and OEM customizations.

## Device Matrix

### OS Versions

| Android Version | API Level | Min Required | Test Device Example |
|---|---|---|---|
| Android 8.0 | 26 | ✅ (minSdk) | Samsung Galaxy S8, Pixel 2 |
| Android 9.0 | 28 | | Pixel 3, Xiaomi Redmi Note 7 |
| Android 10 | 29 | | Samsung Galaxy S10, Pixel 4 |
| Android 11 | 30 | | OnePlus 8, Pixel 5 |
| Android 12 | 31 | | Samsung Galaxy S22, Pixel 6 |
| Android 13 | 33 | | Pixel 7, Samsung Galaxy S23 |
| Android 14 | 34 | ✅ (targetSdk) | Pixel 8, Samsung Galaxy S24 |

### Screen Sizes + Notch/Cutout

| Category | Resolution | Test Focus |
|---|---|---|
| Small (≤ 5") | 720×1280 | Text overflow, button reachability |
| Medium (5-6") | 1080×2400 | Standard layout, PIP overlay position |
| Large (≥ 6.5") | 1440×3200 | Spacing, alignment |
| Notch (top center) | 1080×2400 | AppBar safe area overlap |
| Punch-hole (top center) | 1080×2400 | PIP overlap with camera hole |
| Waterdrop notch | 720×1520 | StatusBar height |
| Foldable (inner screen) | 2208×1840 | Layout reflow on fold/unfold |

### OEM Customizations

| OEM | Known Issues to Check |
|---|---|
| Samsung (One UI) | Edge panel overlaps PIP, Knox restrictions on background service |
| Xiaomi (MIUI) | Aggressive battery optimization kills background socket → whitelist app |
| Huawei (EMUI) | Google Play Services may be missing → Firebase Auth fails |
| OnePlus (OxygenOS) | Generally clean; check notification permissions |
| Pixel (Stock) | Reference implementation; all features should work |

## Test Cases

### 1. Login Flow
- [ ] Phone OTP entry — keyboard doesn't overlap the "Send code" button on small screens.
- [ ] Google Sign-In button — text doesn't overflow on narrow screens.
- [ ] Error messages — localized (TR primary) on all devices.

### 2. Profile Setup
- [ ] Country picker — dropdown doesn't overlap with system navigation bar on devices without gesture nav.
- [ ] Avatar picker — image_picker opens camera/gallery correctly on all OEMs.
- [ ] Gender chips — wrap correctly on narrow screens (no overflow).

### 3. Call Screen
- [ ] Full-screen remote video — fills the screen with no black bars (aspect ratio handling).
- [ ] PIP local video — positioned correctly on notched devices (SafeArea).
- [ ] Bottom controls bar — all 6 buttons visible + tappable on small screens (thumb reach).
- [ ] Wakelock — screen stays on during call on all devices.
- [ ] Camera/mic permission — system dialog appears, retry flow works on deny.

### 4. Wallet + Shop
- [ ] Coin pack cards — layout consistent across screen sizes.
- [ ] Transaction history — pagination loads more correctly.
- [ ] IAP — Google Play Billing dialog opens correctly on all devices with Play Services.

### 5. Settings + GDPR
- [ ] Data export JSON — displays correctly in scrollable container.
- [ ] Legal doc links — open in browser correctly.

### 6. Background/Foreground
- [ ] App backgrounded during call → call ends (system_error reason).
- [ ] App foregrounded → socket reconnects (backoff 1s→2s→4s).
- [ ] Notification permission (Android 13+) — requested on first relevant action.

## Automated Testing

### CI (GitHub Actions)
- `flutter analyze` — lint pass on all files.
- `flutter test` — unit + widget tests.
- `flutter build apk --flavor dev --debug` — compile check.

### Manual Testing
- Run the test cases above on at least 3 devices from the matrix:
  - 1× Android 8-10 (min SDK verification)
  - 1× Android 12-14 (latest OS verification)
  - 1× Notched/punch-hole device (layout verification)

### Firebase Test Lab (optional)
- Run instrumentation tests on 10+ devices simultaneously via Firebase Test Lab.
- `firebase test lab run --type instrumentation --app app-debug.apk --test app-debug-androidTest.apk --device model=walleye,version=28 --device model=redfin,version=30`

## Acceptance

- [ ] All test cases pass on 3+ devices from the matrix
- [ ] No layout overflow on small screens (≤ 5")
- [ ] No crash on Android 8 (minSdk)
- [ ] No crash on Android 14 (targetSdk)
- [ ] PIP overlay doesn't overlap with notch/cutout
- [ ] IAP flow works on Samsung + Pixel (Google Play Services present)
