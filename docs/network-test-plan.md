# RandChat — Network Test Plan

## Objective

Verify call resilience + quality UX under degraded network conditions:
- **3G throttle**: 1.5 Mbps down, 750 Kbps up, 300ms RTT
- **10% packet loss**: random drops affecting video + audio

## Test Setup

### Hardware
- Two physical Android devices (min SDK 26):
  - Device A: Caller (4G/WiFi)
  - Device B: Callee (throttled 3G + packet loss)

### Network Emulation
Use Android's built-in network emulator or Charles Proxy / Network Link Conditioner:

```bash
# Android emulator: throttle to 3G + 10% loss
adb shell svc data disable  # force mobile data
adb shell settings put global network_policy 3g_lossy

# Or use Charles Proxy: Tools → Bandwidth Throttle → 1.5 Mbps / 750 Kbps / 300ms RTT
# Charles Proxy: Tools → Packet Loss → 10%
```

### Test Cases

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1 | Match → Call under 3G | Call connects within 5s | LatencyIndicator shows "fair" (200-500ms) |
| 2 | Call under 10% packet loss | Video freezes briefly, audio continues | Auto-bitrate drops to 320×240@15fps |
| 3 | Network drop mid-call (WiFi → 4G handoff) | Socket disconnect → reconnect → Agora auto-rejoin | Reconnect < 3s, call continues |
| 4 | App background during call | Call leaves (Phase 4 impl) | Call ended with reason=system_error, no zombie socket |
| 5 | App kill → reopen | Socket reconnect with backoff (1s→2s→4s) | Reconnect < 10s, presence refreshed |
| 6 | 3G + high latency (>500ms RTT) | LatencyIndicator shows "poor" (red) | Auto-bitrate to lowest (320×240@15fps) |
| 7 | Packet loss > 30% | Agora SDK reports poor quality | Call continues with degraded video (audio-only fallback) |

## Reconnect Metrics

| Metric | Target |
|---|---|
| Reconnect time (network drop) | < 3s |
| Reconnect time (app kill → reopen) | < 10s |
| Rejoin success rate | > 95% |
| Agora channel resume | Yes (same UID → Agora cache hit) |

## Acceptance

- [ ] Test 1-7 all pass on two real devices
- [ ] Reconnect < 3s on network drop
- [ ] Auto-bitrate engages on poor quality
- [ ] No crash/ANR under any test case
