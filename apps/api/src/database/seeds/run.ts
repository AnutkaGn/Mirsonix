import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';
import { seedReferenceData } from './reference-seed';

loadEnv({ path: ['.env', '../../.env'], quiet: true });

const adminEnv = z.object({
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
});

/** Idempotent: safe to run on every deploy. Existing rows are updated, never duplicated. */
async function seed() {
  await dataSource.initialize();
  await dataSource.transaction(async (em) => {
    await seedReferenceData(em);

    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = adminEnv.parse(process.env);
    if (!email || !password) {
      console.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: skipping admin user.');
      return;
    }
    const users = em.getRepository(User);
    if (await users.existsBy({ email })) {
      console.log(`Admin ${email} already exists, left untouched.`);
      return;
    }
    await users.save(
      users.create({
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        displayName: 'Admin',
        emailVerifiedAt: new Date(),
      }),
    );
    console.log(`Created admin ${email}.`);
  });
  console.log('Seed complete.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => dataSource.destroy());
