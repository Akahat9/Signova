# Signova Flutter private beta

Cross-platform app for account sign-in, offline ISL/ASL recognition, learning, and authenticated one-to-one calls. Camera frames and recognition stay on the device. Firestore carries account and call-room state; WebRTC carries live call media.

## Project structure

```text
lib/
├── main.dart                         # Flutter entry point and platform initialization
├── app/
│   └── signova_app.dart              # App theme and authentication gate
└── features/
    ├── auth/presentation/            # Sign-in and account UI
    ├── home/presentation/            # Main tab shell
    ├── translation/
    │   ├── presentation/             # Camera and translation screen
    │   ├── domain/                   # Platform-independent sequence preprocessing
    │   └── data/                     # ONNX model loading and inference
    ├── learning/presentation/        # Learning UI
    └── calls/
        ├── presentation/             # Call screens and controls
        └── data/                     # Firebase signaling and WebRTC coordination

test/features/                        # Tests grouped to match their feature
```

Keep mobile UI and platform integration in this Flutter project. The React desktop frontend remains in `signova-frontend/`; both clients can use the existing backend contracts. Add each new feature under `lib/features/<feature>/` instead of putting feature code in `main.dart` or a global screens/services folder. Keep domain logic independent of Flutter and Firebase where practical.

## Authentication and authorization

- `features/auth/data/auth_repository.dart` is the Firebase Auth adapter; screens do not call Firebase Auth directly.
- `app/signova_app.dart` is the session gate: signed-out users see sign-in, unverified users must verify email, and verified users enter the app.
- The mobile UI check is for navigation and user feedback. It is not a security boundary. Firestore/Storage Rules and backend Firebase ID-token verification remain authoritative; never grant privileged roles based only on a value stored on the device.
- The first auth flow supports email/password registration, sign-in, email verification/resend, password reset, and sign-out. Email/password must be enabled in Firebase Console > Authentication > Sign-in method for project `signova-6e929`.

## Local development tools

- Install the **Flutter** extension in VS Code; it also installs the Dart extension. Install the Flutter SDK and add its `bin` directory to `PATH`.
- Install Android Studio and its Android SDK/emulator tools to build and run Android locally. On Windows, Android development is available; building/signing iOS requires macOS with Xcode and CocoaPods.
- The app uses the Firebase packages already listed in `pubspec.yaml`; no additional Dart package is needed for email/password authentication.
- After Flutter is installed, run `flutterfire configure --project=signova-6e929` and add the resulting platform Firebase configuration before launching. Enable Email/Password in the Firebase Console. Do not commit private signing keys or service-account credentials.

## Bootstrap

Requires Flutter 3.47.5+, Dart 3.10+, Android API 24+, Xcode on macOS, and Firebase app registrations for Android/iOS. Configure Firebase using the native Android/iOS configuration files before running. Generate native host projects and apply camera/microphone/platform settings with `powershell -ExecutionPolicy Bypass -File scripts/bootstrap-platforms.ps1`, then:

```sh
flutter pub get
python ../../ai-service/Models/export_mobile_models.py --task isl
python ../../ai-service/Models/export_mobile_models.py --task asl_primary
flutter run
```

For calls, pass `--dart-define=SIGNOVA_API_BASE_URL=https://<staging-api-host>` so the app can retrieve short-lived ICE credentials from the authenticated backend endpoint.

The exporter refuses to produce models when ONNX dependencies are missing, and verifies exported logits against the Python reference. Model assets are intentionally ignored by Git: only reviewed, checksummed artifacts should enter beta builds. Supply them through the private release artifact process. No raw training data or consent records belong in this repository.

## iOS floor

The currently selected ONNX Runtime Flutter wrapper requires iOS 16 and static linkage. This app therefore currently targets iOS 16+, although the selected Flutter release supports iOS 15. To retain iOS 15 support, replace the wrapper with a reviewed native ONNX Runtime bridge built against an iOS-15-compatible ORT release and validate it on physical iOS 15 hardware before changing this floor.

## Beta gates

- Both model assets must be exported, checksummed, and compared to Python reference outputs.
- ISL top-30 remains excluded until `model_registry.json` promotion requirements and expert vocabulary approval pass.
- Calling stays private until two physical devices pass cross-network TURN-only call, denial, reconnect, and cleanup checks.
- Store upload/signing secrets are GitHub Actions secrets; never commit them or TURN credentials.

The initial camera feature and local lesson content run without network access. Account sign-in and call setup require connectivity.
