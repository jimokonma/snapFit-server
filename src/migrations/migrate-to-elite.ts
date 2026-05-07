/**
 * One-time migration: upgrade all existing users to the Elite tier.
 *
 * Run via the admin API:
 *   POST /subscriptions/admin/migrate-to-elite
 *
 * Or directly from the terminal:
 *   npx ts-node -e "require('./migrate-to-elite').run()"
 *
 * Safety: idempotent — users already on Elite are skipped.
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Gymtedd';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const subscriptions = db.collection('subscriptions');

  const allUsers = await users.find({}).toArray();
  console.log(`Found ${allUsers.length} users`);

  let migrated = 0;
  let skipped = 0;

  const now = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);
  const resetDate = new Date(now);
  resetDate.setMonth(resetDate.getMonth() + 1);

  for (const user of allUsers) {
    const existingElite = await subscriptions.findOne({
      userId: user._id,
      status: 'active',
      tier: 'elite',
    });

    if (existingElite) {
      skipped++;
      continue;
    }

    // Expire old active subscriptions
    await subscriptions.updateMany(
      { userId: user._id, status: 'active' },
      { $set: { status: 'expired' } },
    );

    await subscriptions.insertOne({
      userId: user._id,
      tier: 'elite',
      billingCycle: 'yearly',
      status: 'active',
      price: 0,
      startDate: now,
      endDate,
      quotaResetDate: resetDate,
      nutritionScansUsed: 0,
      aiImagesUsed: 0,
      aiVideosUsed: 0,
      bodyAnalysisUsed: 0,
      paymentProvider: 'none',
      isGrandfathered: true,
      bonusDaysAdded: 0,
      createdAt: now,
      updatedAt: now,
    });

    await users.updateOne({ _id: user._id }, { $set: { tier: 'elite' } });
    migrated++;
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} already on Elite`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
