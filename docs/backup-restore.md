# RandChat — PostgreSQL Backup + Restore

## Backup Strategy

### 1. Automated Daily Backup (cron)

**Script**: `infra/scripts/pg-backup.sh`

```bash
#!/usr/bin/env bash
# Daily PostgreSQL backup — runs at 03:00 UTC via cron.
set -euo pipefail
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
mkdir -p "$BACKUP_DIR"

# Dump with custom format (compressed, fast restore).
docker exec randchat-pg pg_dump -U randchat -Fc randchat > "$BACKUP_DIR/randchat_$TIMESTAMP.dump"

# Delete backups older than 30 days.
find "$BACKUP_DIR" -name "randchat_*.dump" -mtime +30 -delete

echo "✓ Backup complete: randchat_$TIMESTAMP.dump"
```

**Cron** (on the API server):
```bash
# Edit crontab:
crontab -e
# Add:
0 3 * * * /home/randchat/randchat/infra/scripts/pg-backup.sh >> /var/log/pg-backup.log 2>&1
```

### 2. S3 Offsite Backup

Upload daily backups to S3 for offsite storage:
```bash
# Add to pg-backup.sh after dump:
aws s3 cp "$BACKUP_DIR/randchat_$TIMESTAMP.dump" \
  "s3://randchat-backups/postgres/randchat_$TIMESTAMP.dump" \
  --storage-class STANDARD_IA
```

### 3. Point-in-Time Recovery (WAL Archiving)

Enable WAL archiving in `postgresql.conf`:
```conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://randchat-backups/wal/%f --storage-class GLACIER'
archive_timeout = 300  # 5 min
```

This allows restoring to any point in time (PITR), useful for:
- Accidental DELETE/TRUNCATE recovery.
- Investigating data corruption.

## Restore Procedure

### 1. Stop the API (stop writes)
```bash
docker-compose stop api
```

### 2. Restore from backup
```bash
# Find the latest backup
LATEST=$(ls -t /backups/postgres/randchat_*.dump | head -1)

# Restore
docker exec -i randchat-pg pg_restore -U randchat -d randchat -c < "$LATEST"
```

### 3. Verify
```bash
# Count users
docker exec randchat-pg psql -U randchat -d randchat -c "SELECT COUNT(*) FROM users;"

# Check wallet ledger invariant
docker exec randchat-pg psql -U randchat -d randchat -c "
  SELECT w.balance, SUM(ct.amount) as ledger_sum, 
         (w.balance = SUM(ct.amount)) as invariant_ok
  FROM wallets w 
  JOIN coin_transactions ct ON ct.wallet_id = w.id 
  GROUP BY w.id 
  LIMIT 10;
"

# Check calls table
docker exec randchat-pg psql -U randchat -d randchat -c "SELECT COUNT(*), status FROM calls GROUP BY status;"
```

### 4. Start the API
```bash
docker-compose start api
```

### 5. Verify app health
```bash
curl -sS http://localhost:3000/api/health | jq
```

## Restore Drill (Monthly)

1. **First Tuesday of each month** → run the restore procedure on a staging server.
2. Verify the restored data:
   - User count matches production.
   - Wallet balances match ledger sums.
   - Calls table has expected rows.
3. Record the drill in the operations log:
   - Date + time.
   - Backup file used.
   - Restore duration.
   - Any issues encountered.
4. If issues found → fix the backup script → re-run drill.

## Backup Verification Checklist

- [ ] Daily backup runs at 03:00 UTC (check `/var/log/pg-backup.log`).
- [ ] Backups uploaded to S3 within 1h of creation.
- [ ] Backups older than 30 days deleted from local disk.
- [ ] WAL archive enabled (check S3 `wal/` prefix).
- [ ] Monthly restore drill completed + logged.
- [ ] Restore duration < 30 min for 10GB database.
