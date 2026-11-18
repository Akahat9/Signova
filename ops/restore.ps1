param(
  [ValidateSet('plan', 'apply')][string]$Mode = 'plan',
  [Parameter(Mandatory = $true)][string]$MongoDumpPath,
  [Parameter(Mandatory = $true)][string]$FirestoreExportUri,
  [string]$TargetMongoUri = $env:SIGNOVA_RESTORE_MONGODB_URI,
  [string]$TargetMongoDatabase = 'signova_restore_test',
  [string]$TargetFirebaseProject = $env:SIGNOVA_RESTORE_FIREBASE_PROJECT_ID,
  [switch]$AllowProductionTarget
)

$ErrorActionPreference = 'Stop'
if (-not $AllowProductionTarget -and ($TargetMongoDatabase -eq 'signova' -or $TargetFirebaseProject -eq $env:FIREBASE_PROJECT_ID)) {
  throw 'Production restore target rejected. Use an isolated restore-test project/database.'
}
Write-Host "MongoDB: mongorestore --uri <redacted> --db $TargetMongoDatabase $MongoDumpPath"
Write-Host "Firestore: gcloud firestore import $FirestoreExportUri --project $TargetFirebaseProject"
if ($Mode -ne 'apply') { Write-Host 'Plan only; no data changed.'; exit 0 }
if (-not $TargetMongoUri -or -not $TargetFirebaseProject) { throw 'Restore-test MongoDB URI and Firebase project are required.' }
& mongorestore --uri $TargetMongoUri --db $TargetMongoDatabase --drop $MongoDumpPath
if ($LASTEXITCODE -ne 0) { throw 'mongorestore failed' }
& gcloud firestore import $FirestoreExportUri --project $TargetFirebaseProject
if ($LASTEXITCODE -ne 0) { throw 'Firestore import failed' }
Write-Host 'Restore completed. Run application smoke and integrity checks before declaring the backup valid.'
