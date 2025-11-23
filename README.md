# JoyShockMapper GUI

This repo bundles a modded JoyShockMapper build with a new GUI. For full JSM command documentation, see the upstream project: https://github.com/Electronicks/JoyShockMapper. JSM is robust and not every command is surfaced in the UI; the built-in config editor lets power users add anything that’s missing.

## Quick start
- Download and run (Windows).
- The app launches JSM in the background when it starts and shuts it down when you close the GUI.
- Create or load a profile; map bindings/gyro settings in the UI or import an existing config, then click Apply to push it immediately to JSM.
- Use the Recalibrate button for a quick 5 second calibration whenever you need it.

## What’s different from upstream JSM in this fork
- Custom accel curve implementations (Natural, Power, Quadratic, Sigmoid, Jump) with catch2 unit tests.
- Live telemetry bridge to feed the GUI.
- Global gyro on/off binds exposed in the GUI and per-device ignore gyro binds for people connecting two devices to one JSM instance I.E. external gyro box users.

## GUI Features
- Profile library: create, rename, delete, import, load; Apply pushes the current config straight to the bundled JSM with status messaging.
- Live telemetry: gyro sample readouts and controller metadata displayed in the UI.
- Sensitivity UI: static vs accel, modeshift support, custom accel curves (Linear, Natural, Power, Quadratic, Sigmoid, Jump) with graph and live dot (powered by telemetry).
- Keymap UI: capture bindings per button (tap/hold/double/chord/simultaneous), special actions (gyro on/off/invert/trackball), trackball decay, trigger threshold, and timing windows.
- Touchpad controls: mode toggle (Mouse vs Grid+Stick), grid sizing, sensitivity, bindings.
- Stick controls: modes (Aim, Flick, Flick Only, Rotate Only, Mouse Area, Scroll Wheel, Hybrid Aim), ring modes, deadzones, aim/flick tuning, and modeshift stick mode assignments.
- Per-device gyro ignore toggles.

## Installation for devs (Windows only)

### Build JoyShockMapper core
```bash
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -D SDL=ON
cmake --build . --config Release
```
Optional tests:
```bash
cmake .. -G "Visual Studio 17 2022" -A x64 -D SDL=ON -DBUILD_JSM_TESTS=ON
cmake --build . --config Release
cd JoyShockMapper
ctest --build-config Release
```
Copy the built JoyShockMapper.exe and replace the one found in JSM_custom_curve/JSM_GUI/jsm-gui-app/bin

### GUI app
```bash
cd JSM_GUI/jsm-gui-app
npm install
npm run dev      # hot reload
npm run build    # build + electron-builder package
```

## Links
- Full JSM documentation: https://github.com/Electronicks/JoyShockMapper
- GyroWiki: http://gyrowiki.jibbsmart.com

## Known limitations
- Windows-only; Linux is not supported in this fork.
- Not all JSM features are exposed in the UI—use the config editor pane for advanced commands.
