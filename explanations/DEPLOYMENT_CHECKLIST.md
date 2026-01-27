# Sandbox Persistence Deployment Checklist

## Pre-Deployment ✅

- [x] Feature implemented
- [x] Code reviewed and committed
- [x] TypeScript compilation verified
- [x] Tests passed (where applicable)
- [x] Documentation complete
- [x] No breaking changes

## Deployment Steps

### Phase 1: Schema Deployment

```bash
# Step 1: Deploy Convex schema
cd /home/dih/zapdev
bun run convex:deploy

# Expected output:
# ✔ Deployed Convex functions to production
# ✔ Schema updates applied
```

**Time:** 1-2 minutes

**Verify:**
- [ ] Command completes successfully
- [ ] No error messages
- [ ] Can see confirmation in terminal

---

### Phase 2: Verification

#### 2.1 Convex Dashboard Verification

1. Go to https://dashboard.convex.dev/
2. Select your project
3. Navigate to **Data** → **Tables**
4. Look for `sandboxSessions` table
5. Verify it has 4 indexes:
   - [ ] `by_projectId`
   - [ ] `by_userId`
   - [ ] `by_state`
   - [ ] `by_sandboxId`

**Expected:** Table with 0 documents (no sandboxes created yet)

#### 2.2 Inngest Dashboard Verification

1. Go to https://app.inngest.com/
2. Navigate to **Functions**
3. Look for `auto-pause-sandboxes`
4. Verify status:
   - [ ] Function exists
   - [ ] Status shows "Scheduled"
   - [ ] Cron pattern shows `0 */5 * * * *`
   - [ ] Next execution time is < 5 minutes away

**Expected:** Function scheduled and running

#### 2.3 Local Testing (Optional)

```bash
# Terminal 1: Start dev server
cd /home/dih/zapdev
bun run dev

# Terminal 2: Start Convex dev
cd /home/dih/zapdev
bun run convex:dev

# In browser:
# 1. Navigate to http://localhost:3000
# 2. Create a project
# 3. Check Convex dev output for session creation log
```

**Expected:** Log message: `[DEBUG] Sandbox session created successfully`

---

### Phase 3: Monitoring (First 24 Hours)

#### Inngest Monitoring

Check every hour for first 6 hours:

1. Go to Inngest dashboard
2. Click `auto-pause-sandboxes`
3. Look at **Recent Runs** tab
4. Each run should show:
   - [ ] Status: Success ✓
   - [ ] Duration: < 1 second per sandbox
   - [ ] Execution time: Every 5 minutes

**What to watch for:**
- ✅ Regular successful runs
- ❌ Repeated failures (investigate)
- ❌ Long run times (may indicate issues)

#### Convex Monitoring

Check Convex dashboard:

1. Navigate to **Data** → **sandboxSessions**
2. Verify:
   - [ ] Document count increases (as new projects created)
   - [ ] State changes from RUNNING → PAUSED over time
   - [ ] lastActivity timestamps update

**What to watch for:**
- ✅ Sessions created for new projects
- ✅ Some sessions transition to PAUSED after inactivity
- ❌ No sessions created (investigate sandbox creation)
- ❌ Sessions never pause (check auto-pause job)

#### E2B Cost Monitoring

1. Go to E2B dashboard
2. Compare costs before/after deployment:
   - [ ] Cost should decrease or stabilize
   - [ ] Running sandbox count should be lower
   - [ ] Paused sandbox count should increase

**Expected:** ~30-50% cost reduction after auto-pause

---

## Rollback Plan (If Needed)

### Rollback Step 1: Disable Auto-Pause Job

Edit `src/inngest/functions.ts` line ~2000:

```typescript
// Comment out this line:
// export { autoPauseSandboxes } from "./functions/auto-pause";
```

Then deploy:
```bash
git add src/inngest/functions.ts
git commit -m "chore: disable auto-pause job"
git push origin main
```

**Effect:** Auto-pause stops running, but existing sessions remain

### Rollback Step 2: Clean Up Sessions (Optional)

If you want to remove all session data:

```bash
# In Convex dashboard:
# Data → sandboxSessions → Clear All

# OR run mutation:
bun run convex:deploy  # Reverts schema change
```

**Effect:** All session data deleted

### Rollback Step 3: Verify

- [ ] `auto-pause-sandboxes` no longer appears in Inngest
- [ ] Convex `sandboxSessions` table removed or empty
- [ ] Existing projects still work

---

## Troubleshooting

### Issue: `sandboxSessions` table not created

**Solution:**
```bash
# Re-run deployment
bun run convex:deploy

# Check for errors in output
# If still failing, verify:
# 1. Convex credentials are set
# 2. Project is valid in convex.json
# 3. No syntax errors in schema.ts
```

### Issue: Auto-pause job not showing in Inngest

**Solution:**
```bash
# Verify function is exported
grep -n "autoPauseSandboxes" src/inngest/functions.ts

# Should show export line near end of file
# If missing, add: export { autoPauseSandboxes } from "./functions/auto-pause";

# Then redeploy
git add src/inngest/functions.ts
git commit -m "fix: add missing auto-pause export"
git push origin main
```

### Issue: Sandboxes not pausing

**Solution:**
1. Check `lastActivity` timestamp in Convex
   - Is it > 10 minutes old?
2. Check Inngest logs
   - Are runs successful?
   - Any error messages?
3. Check E2B dashboard
   - Are sandboxes actually created?
4. Increase timeout temporarily for testing
   - Edit `src/inngest/functions.ts` line 814
   - Set `autoPauseTimeout: 2 * 60 * 1000` (2 minutes)
   - Redeploy and wait for next job run

### Issue: Sandboxes not resuming

**Solution:**
1. Verify `getSandbox()` is being called
2. Check browser console for errors
3. Verify E2B API key is valid
4. Check if sandbox is > 30 days old (expired)
5. If paused, manually resume via E2B dashboard

---

## Sign-Off

### Pre-Deployment Sign-Off

- [ ] All files committed and pushed
- [ ] No uncommitted changes
- [ ] Latest main branch pulled

### Deployment Sign-Off

```bash
# Run this to confirm
cd /home/dih/zapdev
git status
# Should be: "nothing to commit, working tree clean"

# Deployment:
bun run convex:deploy
```

- [ ] `bun run convex:deploy` completed successfully
- [ ] No error messages in output

### Post-Deployment Sign-Off

- [ ] Convex dashboard shows `sandboxSessions` table
- [ ] Inngest shows `auto-pause-sandboxes` scheduled
- [ ] First auto-pause job executed successfully
- [ ] No critical errors in logs

---

## Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| Pre | Code review & commit | ✅ Done | Complete |
| Deploy | Run convex:deploy | 1-2 min | ⏭️ Next |
| Verify | Check dashboards | 5 min | ⏭️ After deploy |
| Monitor | Watch for 24 hours | Ongoing | ⏭️ After verify |

---

## Success Criteria

At deployment completion, you should observe:

✅ **Convex:** `sandboxSessions` table exists with proper indexes
✅ **Inngest:** `auto-pause-sandboxes` function scheduled
✅ **E2B:** Cost monitoring shows paused sandboxes

At 24-hour check:

✅ **Auto-pause:** 10+ successful job executions
✅ **Sandboxes:** Some transitioned to PAUSED state
✅ **Cost:** Cost reduction visible in E2B dashboard
✅ **Errors:** No critical failures

---

## Contacts & Resources

### Documentation
- Quick Start: `explanations/SANDBOX_PERSISTENCE_QUICK_START.md`
- Full Docs: `explanations/SANDBOX_PERSISTENCE.md`
- Changes: `SANDBOX_PERSISTENCE_CHANGES.md`
- Implementation: `SANDBOX_PERSISTENCE_IMPLEMENTATION.md`

### Dashboards
- Convex: https://dashboard.convex.dev/
- Inngest: https://app.inngest.com/
- E2B: https://e2b.dev/account/

### Support
- E2B Docs: https://e2b.dev/docs/sandbox/persistence
- Inngest Docs: https://www.inngest.com/docs/guides/cron
- Convex Docs: https://docs.convex.dev/

---

## Notes

- All changes are backward compatible
- No user-facing changes required
- Can be deployed immediately
- Rollback is safe and reversible
- Estimated cost savings: 30-50%

---

**Deployment Date:** _________________
**Deployed By:** _________________
**Notes:** _________________

---

**Last Updated:** 2025-11-15
**Status:** Ready for immediate deployment ✅
