// ─────────────────────────────────────────────────────────────────────────────
// backend/scripts/migrations/001_add_team_hierarchy.js
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 1 migration. Run ONCE against production before deploying Phase 1 code.
//
// What it does:
//   1. Adds `teamId: null`, `reportsTo: null`, `isActive: true` to every User
//      document that is missing these fields.
//   2. Remaps the legacy 'manager' role to 'hod'.
//      (If you want some managers to become 'team_lead' instead, adjust the
//      MANAGER_TO_ROLE_MAP below before running.)
//   3. Creates the new compound indexes on the users collection that the
//      User model now defines.
//   4. Is idempotent — safe to re-run; it checks before writing.
//
// Usage:
//   NODE_ENV=production node backend/scripts/migrations/001_add_team_hierarchy.js
//
// Requirements:
//   MONGODB_URI environment variable must be set (same as your app config).
//
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config(); // load .env from project root

const mongoose = require('mongoose');

// ── Configuration ─────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

/**
 * How to remap the legacy 'manager' role.
 * Change values to 'team_lead' for any specific user email if needed.
 * Default: all managers → 'hod'
 *
 * Format: { 'user@email.com': 'team_lead' }
 * Unmatched managers default to 'hod'.
 */
const MANAGER_OVERRIDE_MAP = {
  // 'alice@example.com': 'team_lead',
};

// ─────────────────────────────────────────────────────────────────────────────
// Migration steps
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection.db;
  console.log(`Connected to database: ${db.databaseName}`);

  // ── Step 1: Add missing fields to all User documents ──────────────────────

  console.log('\n[Step 1] Adding teamId, reportsTo, isActive to User documents...');

  // Single pipeline update (MongoDB 4.2+).
  // Each field is set only when it is missing from the document, so this
  // operation is safe to re-run — existing values are never overwritten.
  //
  // $type check for 'missing' handles the case where the field was never
  // written.  $ifNull handles the case where the field exists but is null
  // (we keep null in that case, since null is a valid intentional value for
  // teamId and reportsTo).
  const pipelineResult = await db.collection('users').updateMany(
    {},
    [
      {
        $set: {
          teamId: {
            $cond: [{ $eq: [{ $type: '$teamId' }, 'missing'] }, null, '$teamId'],
          },
          reportsTo: {
            $cond: [{ $eq: [{ $type: '$reportsTo' }, 'missing'] }, null, '$reportsTo'],
          },
          isActive: {
            $cond: [{ $eq: [{ $type: '$isActive' }, 'missing'] }, true, '$isActive'],
          },
        },
      },
    ]
  );

  console.log(`  ✓ Users processed: ${pipelineResult.matchedCount}, modified: ${pipelineResult.modifiedCount}`);

  // ── Step 2: Remap legacy 'manager' role ───────────────────────────────────

  console.log('\n[Step 2] Remapping legacy "manager" role...');

  const managers = await db.collection('users')
    .find({ role: 'manager' }, { projection: { _id: 1, email: 1, name: 1 } })
    .toArray();

  console.log(`  Found ${managers.length} manager(s) to remap.`);

  let remappedToHod      = 0;
  let remappedToTeamLead = 0;

  for (const mgr of managers) {
    const newRole = MANAGER_OVERRIDE_MAP[mgr.email] ?? 'hod';

    await db.collection('users').updateOne(
      { _id: mgr._id },
      { $set: { role: newRole } }
    );

    if (newRole === 'hod')       remappedToHod++;
    if (newRole === 'team_lead') remappedToTeamLead++;

    console.log(`  ✓ ${mgr.name} (${mgr.email}) → ${newRole}`);
  }

  if (managers.length === 0) {
    console.log('  (No legacy manager documents found — skipping.)');
  } else {
    console.log(`  Remapped: ${remappedToHod} → hod, ${remappedToTeamLead} → team_lead`);
  }

  // ── Step 3: Create new indexes on users collection ────────────────────────

  console.log('\n[Step 3] Creating new indexes on users collection...');

  const userIndexes = [
    {
      key:  { teamId: 1, role: 1 },
      name: 'teamId_1_role_1',
    },
    {
      key:  { reportsTo: 1 },
      name: 'reportsTo_1',
    },
    {
      key:  { isActive: 1 },
      name: 'isActive_1',
    },
  ];

  for (const idx of userIndexes) {
    try {
      await db.collection('users').createIndex(idx.key, { name: idx.name, background: true });
      console.log(`  ✓ Index created: ${idx.name}`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        // IndexOptionsConflict or IndexKeySpecsConflict — index already exists
        console.log(`  - Index already exists: ${idx.name} (skipped)`);
      } else {
        throw err;
      }
    }
  }

  // ── Step 4: Ensure the teams collection exists with indexes ───────────────

  console.log('\n[Step 4] Preparing teams collection...');

  // IMPORTANT — autoIndex must be disabled in production before deploying
  // Phase 1 code.  If Mongoose autoIndex runs first on app startup it will
  // create the { name: 1 } index WITHOUT collation (Mongoose does not reliably
  // forward the collation option via schema.index()).  This migration then
  // tries to create the same key with collation, triggers IndexOptionsConflict
  // (code 85), and skips it — leaving the index without case-insensitive
  // collation.
  //
  // Mitigation: before creating the collation index we drop any existing
  // plain { name: 1 } index so we can recreate it correctly.  This is safe —
  // no data is affected by dropping an index.
  //
  // In your Mongoose connection options, for production environments set:
  //   mongoose.set('autoIndex', false);
  // or pass { autoIndex: false } to mongoose.connect() options.

  const collections = await db.listCollections({ name: 'teams' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('teams');
    console.log('  ✓ Created "teams" collection');
  } else {
    console.log('  - "teams" collection already exists (skipped)');
  }

  // Drop any pre-existing plain name index so the collation version can be
  // created cleanly below.
  try {
    const existingIndexes = await db.collection('teams').indexes();
    const plainNameIndex  = existingIndexes.find(
      (idx) => idx.key && idx.key.name === 1 && !idx.collation
    );
    if (plainNameIndex) {
      await db.collection('teams').dropIndex(plainNameIndex.name);
      console.log(`  ✓ Dropped plain name index "${plainNameIndex.name}" — will recreate with collation`);
    }
  } catch (_dropErr) {
    // Non-fatal: if the collection is empty or the index never existed, continue.
    console.log('  - No conflicting plain name index found (skipped drop)');
  }

  const teamIndexes = [
    {
      key:  { hod: 1, isActive: 1 },
      name: 'hod_1_isActive_1',
    },
    {
      key:  { teamLead: 1 },
      name: 'teamLead_1',
    },
    {
      key:  { isActive: 1 },
      name: 'isActive_1',
    },
    // Case-insensitive unique name index for active teams.
    // Must be created via the MongoDB driver (not Mongoose schema.index()) to
    // guarantee the collation option is applied.
    {
      key:       { name: 1 },
      name:      'name_1_unique_active',
      unique:    true,
      partialFilterExpression: { isActive: true },
      collation: { locale: 'en', strength: 2 },
    },
  ];

  for (const idx of teamIndexes) {
    const { key, name, ...options } = idx;
    try {
      await db.collection('teams').createIndex(key, { name, background: true, ...options });
      console.log(`  ✓ Index created: teams.${name}`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`  - Index already exists: teams.${name} (skipped)`);
      } else {
        throw err;
      }
    }
  }

  // ── Step 5: Verification summary ─────────────────────────────────────────

  console.log('\n[Step 5] Verification...');

  const roleBreakdown = await db.collection('users').aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log('  User role distribution after migration:');
  for (const r of roleBreakdown) {
    console.log(`    ${r._id}: ${r.count}`);
  }

  const usersWithoutTeamId = await db.collection('users')
    .countDocuments({ teamId: { $exists: false } });
  console.log(`  Users missing teamId field: ${usersWithoutTeamId} (should be 0)`);

  const legacyManagers = await db.collection('users')
    .countDocuments({ role: 'manager' });
  console.log(`  Remaining legacy "manager" role docs: ${legacyManagers} (should be 0)`);

  console.log('\n✅ Migration 001 completed successfully.\n');
}

// ─────────────────────────────────────────────────────────────────────────────

run()
  .then(() => {
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    mongoose.disconnect();
    process.exit(1);
  });
