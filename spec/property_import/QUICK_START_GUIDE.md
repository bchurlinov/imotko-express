# Property Import System - Quick Start Guide

## Overview

The property import system automatically fetches, processes, and imports property listings from external sources into your database. It includes automated scheduling, image processing, AI-powered data normalization, and comprehensive monitoring.

## Setup (First Time)

### 1. Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Create migration for import job tracking
npx prisma migrate dev --name add_import_job_execution_tracking
```

### 2. Environment Configuration

Add to your `.env` file:

```bash
# Required
OPENAI_API_KEY=sk-your-openai-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Import Job Configuration
IMPORT_DATA_SOURCE_URL=https://globalracecalendar.com/imotko/delta.json
IMPORT_SYSTEM_USER_ID=your-system-user-id-here
IMPORT_DEFAULT_AGENCY_ID=your-agency-id-here
IMPORT_BATCH_SIZE=10
IMPORT_TEST_MODE=false
IMPORT_TEST_SKIP_IMAGES=false

# Cron Scheduling
IMPORT_CRON_SCHEDULE=0 0 * * *        # Daily at midnight
IMPORT_ALERT_THRESHOLD=3              # Alert after 3 consecutive failures
TZ=Europe/Skopje                      # Your timezone
```

### 3. Create System User (if needed)

```bash
# Run the seed script to create system user
node prisma/seed.js
```

Or manually via Prisma Studio:
```bash
npx prisma studio
```

Update `IMPORT_SYSTEM_USER_ID` in `.env` with the user ID.

## Running the System

### Start the Server

The import job will automatically schedule when the server starts:

```bash
npm run dev
# or
npm start
```

Expected output:
```
Server is listening on port 5050...

📅 Scheduling cron jobs...
[PropertyImport] ✅ Scheduled job registered: "0 0 * * *" (Europe/Skopje)
✅ All cron jobs scheduled
```

### Test Mode (Recommended First)

Before running in production, test the import:

```bash
# In .env
IMPORT_TEST_MODE=true
IMPORT_TEST_SKIP_IMAGES=true
IMPORT_BATCH_SIZE=3

# Run manually
node src/jobs/import_properties.js
```

This will:
- ✅ Fetch real data
- ✅ Validate and normalize
- ✅ Process through full pipeline
- ❌ NOT save to database
- ❌ NOT upload images
- ✅ Show what WOULD be saved

### Production Mode

Once testing looks good:

```bash
# In .env
IMPORT_TEST_MODE=false
IMPORT_TEST_SKIP_IMAGES=false
IMPORT_BATCH_SIZE=10

# Restart server to apply changes
npm run dev
```

## Manual Triggers

### Via API

```bash
# Trigger import
curl -X POST http://localhost:5050/api/v1/admin/import-jobs/trigger

# Check if running
curl http://localhost:5050/api/v1/admin/import-jobs/status

# Get last execution
curl http://localhost:5050/api/v1/admin/import-jobs/last
```

### Via Command Line

```bash
# Run the job directly
node src/jobs/import_properties.js
```

## Monitoring

### Check Import History

```bash
# Get last 10 executions
curl "http://localhost:5050/api/v1/admin/import-jobs/history?limit=10"

# Get only failures
curl "http://localhost:5050/api/v1/admin/import-jobs/history?status=FAILED"

# Get cron-triggered executions
curl "http://localhost:5050/api/v1/admin/import-jobs/history?triggeredBy=cron"
```

### View Statistics

```bash
# Last 30 days
curl "http://localhost:5050/api/v1/admin/import-jobs/statistics?days=30"

# Last 7 days
curl "http://localhost:5050/api/v1/admin/import-jobs/statistics?days=7"
```

### Check Specific Execution

```bash
# Get detailed execution record (including errors)
curl "http://localhost:5050/api/v1/admin/import-jobs/{execution-id}"
```

## Common Scenarios

### Change Schedule

Edit `.env`:
```bash
# Run every 6 hours
IMPORT_CRON_SCHEDULE=0 */6 * * *

# Run daily at 2:30 AM
IMPORT_CRON_SCHEDULE=30 2 * * *

# Run every Sunday at midnight
IMPORT_CRON_SCHEDULE=0 0 * * 0
```

Restart server for changes to take effect.

### Temporarily Disable Automatic Imports

Option 1 - Invalid schedule (job won't schedule):
```bash
IMPORT_CRON_SCHEDULE=invalid
```

Option 2 - Very far future schedule:
```bash
IMPORT_CRON_SCHEDULE=0 0 1 1 *  # January 1st only
```

You can still trigger manually via API.

### Import Small Batch for Testing

```bash
# In .env
IMPORT_BATCH_SIZE=3
IMPORT_TEST_MODE=true

# Run
node src/jobs/import_properties.js
```

### Skip Image Processing

```bash
IMPORT_TEST_SKIP_IMAGES=true
```

Useful for:
- Testing without using OpenAI/Supabase credits
- Faster execution
- Debugging data normalization issues

## Troubleshooting

### Import Not Running

1. Check if scheduled:
   ```bash
   curl http://localhost:5050/api/v1/admin/import-jobs/status
   ```

2. Check logs for errors:
   ```
   [PropertyImport] ❌ Invalid cron schedule: "..."
   ```

3. Verify environment variables:
   ```bash
   echo $IMPORT_CRON_SCHEDULE
   ```

### All Properties Failing

1. Check API connectivity:
   ```bash
   curl https://globalracecalendar.com/imotko/delta.json
   ```

2. Check OpenAI API key:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. Check execution details:
   ```bash
   curl http://localhost:5050/api/v1/admin/import-jobs/last
   ```

4. Run in test mode to see errors:
   ```bash
   IMPORT_TEST_MODE=true node src/jobs/import_properties.js
   ```

### Consecutive Failures Alert

If you see:
```
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🚨 ALERT: 3 consecutive import job failures!
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
```

1. Check last execution errors:
   ```bash
   curl http://localhost:5050/api/v1/admin/import-jobs/last
   ```

2. Check execution history:
   ```bash
   curl "http://localhost:5050/api/v1/admin/import-jobs/history?limit=5&status=FAILED"
   ```

3. Common causes:
   - API endpoint down
   - Invalid API keys
   - Database connection issues
   - Out of OpenAI credits

### Images Not Uploading

1. Check Supabase credentials:
   ```bash
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. Verify bucket exists:
   - Go to Supabase dashboard
   - Check Storage section
   - Ensure "imotko-prod" bucket exists

3. Check bucket permissions:
   - Make bucket public or configure RLS

### Duplicate Properties

The system automatically skips duplicates based on `externalId`.

To force re-import:
1. Delete existing properties with same `externalId`
2. Or modify `generateExternalId()` logic

## Performance Tuning

### Increase Throughput

```bash
# Process larger batches
IMPORT_BATCH_SIZE=20

# Warning: May hit rate limits!
```

### Reduce API Costs

```bash
# Smaller batches = fewer concurrent AI calls
IMPORT_BATCH_SIZE=5

# Skip images in test mode
IMPORT_TEST_SKIP_IMAGES=true
```

### Balance Speed vs Cost

Current settings (recommended):
- Batch size: 10 properties
- Sequential processing within batch
- 2-second delay between batches
- Rate limiting on AI calls (100ms)

## API Endpoints Reference

### GET /api/v1/admin/import-jobs/history
- Get paginated execution history
- Query params: `limit`, `offset`, `status`, `triggeredBy`

### GET /api/v1/admin/import-jobs/statistics
- Get execution statistics
- Query param: `days` (default: 30)

### GET /api/v1/admin/import-jobs/last
- Get most recent execution

### GET /api/v1/admin/import-jobs/status
- Get current job status and schedule

### GET /api/v1/admin/import-jobs/:executionId
- Get detailed execution record

### POST /api/v1/admin/import-jobs/trigger
- Manually trigger import job

⚠️ **Security Note**: These endpoints should be protected with authentication before production deployment!

## Cron Schedule Examples

```bash
# Every day at midnight
0 0 * * *

# Every day at 2:30 AM
30 2 * * *

# Every 6 hours
0 */6 * * *

# Every Monday at 9 AM
0 9 * * 1

# Every 15 minutes (testing)
*/15 * * * *

# First day of month at midnight
0 0 1 * *
```

## Best Practices

1. **Always test first**: Use `IMPORT_TEST_MODE=true`
2. **Start small**: Begin with `IMPORT_BATCH_SIZE=3`
3. **Monitor closely**: Check execution history regularly
4. **Set alerts**: Configure `IMPORT_ALERT_THRESHOLD`
5. **Protect endpoints**: Add authentication to admin APIs
6. **Backup data**: Before first production run
7. **Review logs**: Check for validation errors
8. **Verify geocoding**: Ensure coordinates are accurate
9. **Check duplicates**: Monitor skip rates
10. **Plan schedules**: Off-peak hours for large imports

## Support

For issues or questions:
1. Check execution logs in database
2. Review error details via API endpoints
3. Run in test mode to isolate issues
4. Check Phase 7 summary documentation
5. Verify all environment variables are set

## System Status Checklist

Before going to production:

- [ ] Database migration applied
- [ ] System user created and ID configured
- [ ] All environment variables set
- [ ] Test mode run successful
- [ ] Small production batch tested
- [ ] Cron schedule configured
- [ ] Admin endpoints protected
- [ ] Monitoring dashboard set up (optional)
- [ ] Alert notifications configured (optional)
- [ ] Backup procedures in place

## Quick Health Check

```bash
# 1. Check server is running
curl http://localhost:5050/api/v1/admin/import-jobs/status

# 2. Check last execution
curl http://localhost:5050/api/v1/admin/import-jobs/last

# 3. Check recent stats
curl "http://localhost:5050/api/v1/admin/import-jobs/statistics?days=7"

# All green? You're good to go! 🚀
```
