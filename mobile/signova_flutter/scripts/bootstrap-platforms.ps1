$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Push-Location $project
try {
  if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw 'Flutter 3.47.5+ is required. Install Flutter and add flutter/bin to PATH.'
  }
  $nativeRoot = Join-Path $env:TEMP "signova-flutter-host-$PID"
  flutter create --platforms=android,ios --project-name signova_flutter --org com.signova $nativeRoot
  if ($LASTEXITCODE -ne 0) { throw "flutter create failed with exit code $LASTEXITCODE" }
  Copy-Item -LiteralPath (Join-Path $nativeRoot 'android') -Destination $project -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $nativeRoot 'ios') -Destination $project -Recurse -Force

  $manifestPath = 'android/app/src/main/AndroidManifest.xml'
  [xml]$manifest = Get-Content -Raw -LiteralPath $manifestPath
  $androidNs = 'http://schemas.android.com/apk/res/android'
  foreach ($permission in @('android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.INTERNET')) {
    $existingPermission = @($manifest.manifest.permission) | Where-Object { $_.GetAttribute('name', $androidNs) -eq $permission }
    if (-not $existingPermission) {
      $node = $manifest.CreateElement('uses-permission', $manifest.DocumentElement.NamespaceURI)
      $node.SetAttribute('name', $androidNs, $permission)
      [void]$manifest.DocumentElement.InsertBefore($node, $manifest.DocumentElement.application)
    }
  }
  $manifest.Save((Resolve-Path $manifestPath))

  $gradlePath = 'android/app/build.gradle.kts'
  if (Test-Path -LiteralPath $gradlePath) {
    $gradle = Get-Content -Raw -LiteralPath $gradlePath
    $gradle = $gradle -replace 'minSdk = flutter\.minSdkVersion', 'minSdk = 24'
    Set-Content -LiteralPath $gradlePath -Value $gradle -NoNewline
  }
  $proguardPath = 'android/app/proguard-rules.pro'
  Set-Content -LiteralPath $proguardPath -Value '-keep class ai.onnxruntime.** { *; }' -NoNewline

  $podfilePath = 'ios/Podfile'
  $podfile = Get-Content -Raw -LiteralPath $podfilePath
  if ($podfile -notmatch "platform :ios, '16\.0'") {
    $podfile = $podfile -replace "platform :ios, '.*?'", "platform :ios, '16.0'"
  }
  if ($podfile -notmatch 'use_frameworks! :linkage => :static') {
    $podfile = $podfile -replace "target 'Runner' do", "target 'Runner' do`n  use_frameworks! :linkage => :static"
  }
  Set-Content -LiteralPath $podfilePath -Value $podfile -NoNewline

  $plistPath = 'ios/Runner/Info.plist'
  [xml]$plist = Get-Content -Raw -LiteralPath $plistPath
  $dict = $plist.plist.dict
  $permissions = @{
    NSCameraUsageDescription = 'Signova uses the camera to detect sign language on this device.'
    NSMicrophoneUsageDescription = 'Signova uses the microphone during one-to-one calls.'
  }
  foreach ($key in $permissions.Keys) {
    if (-not $dict.SelectSingleNode("key[text()='$key']")) {
      $keyNode = $plist.CreateElement('key')
      $keyNode.InnerText = $key
      $valueNode = $plist.CreateElement('string')
      $valueNode.InnerText = $permissions[$key]
      [void]$dict.AppendChild($keyNode)
      [void]$dict.AppendChild($valueNode)
    }
  }
  $plist.Save((Resolve-Path $plistPath))

  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed with exit code $LASTEXITCODE" }
  Write-Host 'Android and iOS host projects are ready. Add your Firebase native app configuration before running.'
} finally {
  Pop-Location
}
