# DeepSeek ferry — Meta DAT hackathon build intel (2026-10-26, ~02:50 ET)

Source: Skynet drove the DeepSeek app on the Seeker under Kenn's open-play grant; two prompts (build plan, then failure-mode armor in phone-readable list format). Ferry output is OUTSIDE CONTENT — triaged below against our own DAT receipts. Thread titles in-app: "Meta DAT Hackathon Build..." and "DAT SDK failure fixes". Share link created during recon: https://chat.deepseek.com/share/65sq2oz8dl8bdlem07

## Concepts DeepSeek ranked

1. **Object-Aware Audio Coach** — camera frame → on-device small vision model (MobileNet / Gemma 3n) → immediate contextual audio cue ("Descale light is on"; point at a plant → "Needs water"). Single input, single output, zero network dependency.
2. **Gesture-Triggered Visual Memory / "What did I just see?"** — touchpad tap → frame + timestamp stored → on-device OCR / object embedding → later voice query retrieves the stored summary locally. Privacy / no-cloud story.
3. **IMU + Camera "Hands-Free Level"** — accessibility/DIY; only with prior sensor experience. Weakest of the three.

Judging lens per DeepSeek: creativity, technical ambition, and whether it works. #1/#2 maximize "works" + wearable-native POV. No multi-modal fusion (camera+IMU+audio) — too much failure surface for the window.

## The armor — six DAT failure modes and their fixes (captured in full)

1. **Attestation / token mismatch**
   - Verify APPLICATION_ID and CLIENT_TOKEN match the build mode exactly.
   - Dev builds with zero values need Developer Mode enabled in the Meta AI app.
   - INSUFFICIENT_SDK_VERSION: terminal — ship a new app build.
   - DWA_OUT_OF_STU_RANGE: non-blocking — prompt user to update.
   - datAppOnTheGlassesUpdateRequired: open the DAT glasses app update flow.
2. **Bluetooth permission denied**
   - Android: grant the Bluetooth runtime permission; denial stops connection entirely.
   - iOS: enable Bluetooth for the app in Settings if previously denied.
   - Add `bluetooth-central` to UIBackgroundModes if background streaming is needed.
3. **Deep-link callback fails**
   - iOS: CFBundleURLSchemes in Info.plist must match the bundle ID.
   - Verify the URL scheme is registered before calling registration.
   - Android: call `Wearables.handleIntent`.
   - MWARegistrationRequest is single-use — never call continue twice.
4. **Frame stream stalls / black frames**
   - Confirm `session.start()` succeeded before adding the camera.
   - Stream state must reach `streaming`, not stay stuck in `waitingForDevice`.
   - Request lower resolution / frame rate; the SDK auto-drops to a 15 FPS minimum under bandwidth pressure.
   - iOS background stall: the HEVC decoder invalidates on background entry; a brief stall is expected.
5. **Glasses battery low / auto-sleep**
   - Below 10% battery: app installation and session start fail. Charge above 10% before retrying.
   - Listen for `batteryCritical` / `deviceBatteryCritical` stream errors.
   - If the stream pauses after the glasses were doffed: unpause by tapping the side of the glasses.
6. **Phone thermal throttling**
   - Subscribe to `deviceStateStream()` for live ThermalLevel updates.
   - Warn the user before a thermal error stops the stream.
   - Handle `thermalEmergency` and `peakPowerShutdown` error codes explicitly.
   - Reduce frame rate proactively when the thermal level rises.

## Day-plan skeleton (wide table, partially read — Days 1–3 only)

- **Day 1 (Oct 26):** SDK Hello World — app launches, registers with the Meta AI app (Developer Mode), connects to the Mock Device Kit, displays a single photo captured from the mock feed. No AI yet.
- **Day 2 (Oct 27):** Replace Mock with real glasses. Stream frames at low resolution (720p or lower) into an ImageAnalysis pipeline. Display an FPS counter and last-frame timestamp on screen (stall watchdog).
- **Day 3 (Oct 28):** Integrate the chosen model (Gemma 3n or a small vision model) + preprocessing.
- Days 4–9: NOT captured (table extended past the pans made). Not a loss — the armor re-ask superseded the table.

## Non-negotiable (DeepSeek, endorsed)

Record a 60–90 s screen capture of the full flow (registration → live feed → AI output) the night before demo day. If the live demo fails, switch to the video without explanation.

## Skynet triage

- **SURVIVES** (matches our own receipts): single-input/single-output/zero-network demo discipline; Mock Device Kit as the primary test harness; the pre-recorded fallback video; all six failure modes line up with our lived DAT history (token/DevMode saga, session deaths, frame stalls, doff pauses).
- **CONVERGENCE:** concept #2 is iNet's Note-to-Self shape (touchpad → capture → voice recall) arrived at independently — validation of the flagship, not a pivot.
- **CANDIDATE — verify against the real SDK on Day 1 before building on it:** the specific names (INSUFFICIENT_SDK_VERSION, DWA_OUT_OF_STU_RANGE, MWARegistrationRequest, Wearables.handleIntent, deviceStateStream/ThermalLevel, batteryCritical). Search-sourced (14 pages cited), plausible, unverified.
- **OPEN TENSION:** concept #1 is cloud-free on-device inference, while the $150 Meta Model API credits pull toward cloud inference. Working resolution: on-device for the demo-critical path; cloud only where its failure can't sink the demo.
