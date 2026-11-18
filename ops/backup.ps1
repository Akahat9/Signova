param(
  [ValidateSet('plan', 'apply')][string]$Mode = 'plan',
  [string]$BackupRoot = './backups',
  [string]$FirebaseProject = $env:FIREBASE_PROJECT_ID,
  [string]$FirestoreBucket = $env:SIGNOVA_FIRESTORE_BACKUP_BUCKET,
  [string]$MongoUri = $env:MONGODB_URI,
  [string]$MongoDatabase = $(if ($env:MONGODB_DATABASE) { $env:MONGODB_DATABASE } else { 'signova' })
)

$ErrorActionPreference = 'Stop'
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$mongoTarget = Join-Path $BackupRoot "mongo-$timestamp"
$firestoreTarget = $(if ($FirestoreBucket) { "gs://$FirestoreBucket/firestore/$timestamp" } else { 'gs://<backup-bucket>/firestore/<timestamp>' })

Write-Host "MongoDB: mongodump --uri <redacted> --db $MongoDatabase --out $mongoTarget"
Write-Host "Firestore: gcloud firestore export $firestoreTarget --project $(if ($FirebaseProject) { $FirebaseProject } else { '<firebase-project>' })"

if ($Mode -ne 'apply') {
  Write-Host 'Plan only. Re-run with -Mode apply after validating destinations, retention, encryption, and credentials.'
  exit 0
}

if (-not $MongoUri -or -not $FirebaseProject -or -not $FirestoreBucket) {
  throw 'MONGODB_URI, FIREBASE_PROJECT_ID, and SIGNOVA_FIRESTORE_BACKUP_BUCKET are required.'
}
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
& mongodump --uri $MongoUri --db $MongoDatabase --out $mongoTarget
if ($LASTEXITCODE -ne 0) { throw 'mongodump failed' }
& gcloud firestore export $firestoreTarget --project $FirebaseProject
if ($LASTEXITCODE -ne 0) { throw 'Firestore export failed' }
Write-Host "Backup completed: MongoDB=$mongoTarget Firestore=$firestoreTarget"
