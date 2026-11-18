# Private Identity Resolver

Username and phone lookup no longer reads public Firestore documents from the browser.

## Required backend environment

- `FIREBASE_PROJECT_ID=signova-6e929`
- `FIREBASE_WEB_API_KEY=<Firebase web API key>`
- `SIGNOVA_IDENTITY_HMAC_SECRET=<at least 32 random characters>`
- Google Application Default Credentials or workload identity for Firebase Admin

The HMAC secret must remain stable. Changing it makes existing hashed username and phone mappings unreachable.

## Existing account migration

Before deploying the locked Firestore rules, migrate existing legacy identity documents:

```powershell
$env:FIREBASE_PROJECT_ID='signova-6e929'
$env:SIGNOVA_IDENTITY_HMAC_SECRET='<same production secret>'
$env:GOOGLE_APPLICATION_CREDENTIALS='<service-account-json-path>'
npm run migrate:identities
```

After validating username and phone login, legacy `publicUserIdentities` documents can be deleted from the Firebase console. The deployed rules deny all client access to both identity collections. 
