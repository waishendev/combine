# Gentlegurls Print Platform — Phase 1 operations

Phase 1 persists `test_print` jobs and simulates processing in the Android agent. It does not communicate with a physical printer. `Printer` records are transport-neutral foundations for Bluetooth and network ESC/POS support in Phase 2.

## Backend environment

Install PHP dependencies after pulling the change:

```bash
# First pull in Reverb and refresh composer.lock (required once for this change).
composer update laravel/reverb --with-all-dependencies
php artisan migrate --force
php artisan db:seed --class=PrintPlatformPermissionSeeder --force
```

Configure unique production secrets (never commit their values):

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=gentlegurls-print-production
REVERB_APP_KEY=<random-public-app-key>
REVERB_APP_SECRET=<random-secret>
REVERB_HOST=print-ws.example.com
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080
QUEUE_CONNECTION=database
```

Four processes are required after every server restart:

```bash
php artisan serve                 # replace with the production PHP/FPM web stack
php artisan queue:work --tries=3 --timeout=90
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan schedule:work
```

Use Supervisor/systemd/Kubernetes rather than interactive shells in production. Restart Reverb and queue workers after deployment.

## WSS reverse proxy

Terminate TLS at the public reverse proxy and forward WebSocket upgrade requests to Reverb port 8080. Preserve `Host`, `Upgrade`, `Connection`, and forwarding headers; allow long-lived connections and use an idle timeout comfortably above Reverb's ping interval. The REST API and broadcast authentication endpoint must remain HTTPS. Restrict allowed origins for the deployed environments before public rollout (the checked-in configuration uses `*` to support native clients during Phase 1).

## Android configuration

Defaults target the Android emulator (`10.0.2.2`). Override without committing secrets:

```bash
./gradlew assembleDebug \
  -PPRINT_AGENT_API_URL=https://api.example.com/api/ \
  -PPRINT_AGENT_WS_URL=wss://print-ws.example.com/app/<REVERB_APP_KEY>
```

The API URL must end in `/`. Production requires HTTPS/WSS with a publicly trusted certificate. Cleartext defaults are for local emulator development only.

Run checks:

```bash
./gradlew testDebugUnitTest
./gradlew connectedDebugAndroidTest   # emulator/device required
```

## Pairing and test flow

1. Seed permissions and grant the appropriate `print.*` permissions to Branch roles.
2. In CRM, select a concrete Header Branch and open **Settings → Printers & Devices**.
3. Create a device and enter the displayed eight-character, ten-minute pairing code on Android.
4. Start the agent. Its foreground notification should remain visible.
5. Select **Test Print** in CRM. The Android agent displays the simulated job and acknowledges it; CRM refreshes status every 15 seconds.

An offline agent processes pending jobs after startup, WebSocket reconnect, network recovery/WorkManager execution, and its periodic foreground reconciliation.

## Revocation

Revoking a device marks it revoked and deletes all Sanctum tokens. Subsequent API and private-channel authorization fails. If the device UI still appears connected briefly, the server rejects its next authenticated operation; close existing WebSocket connections at the reverse proxy/Reverb operational layer when immediate transport teardown is required.

## Troubleshooting

- **Job remains pending:** verify the queue worker, Reverb process, Android foreground service, API URL, and that reconciliation can reach `POST /api/print-agent/jobs/claim-next`. A missing event is not data loss; reconciliation remains authoritative.
- **WebSocket connects but private subscribe fails:** verify the bearer token, device status, Reverb app credentials, and `/api/broadcasting/auth` routing.
- **401 after pairing:** the device was revoked, token rotated, storage/Keystore was invalidated, or the API base URL points to another environment. Pair again where appropriate.
- **Pairing code rejected:** codes are one-time and expire after ten minutes. Regenerate from the concrete Branch page.
- **CRM shows offline:** heartbeat is every 60 seconds and online threshold is 150 seconds. Confirm the foreground notification is active.
- **Broadcast outage:** inspect application logs for the safe broadcast warning. The committed PrintJob remains valid and will be reconciled.

## Phase 2 boundary

Before physical printing, add transport-specific printer setup, ESC/POS capability profiles, and an `outcome_unknown` state. A job that may have reached paper must not be automatically reprinted after an ACK-loss lease expiry. Phase 1 retries are safe only because processing is simulated.
