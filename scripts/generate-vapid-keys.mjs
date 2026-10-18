#!/usr/bin/env node
// Generates the VAPID key pair for Web Push reminders. Run once:  node scripts/generate-vapid-keys.mjs
// Paste the output into your hosting provider's environment variables (and .env.local for local testing).
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:you@example.com   # change to your email (or https://your-site)`);
console.log(`CRON_SECRET=${randomBytes(24).toString("hex")}`);
