import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Left at defaults on purpose: this file exists only so the app can be
// built for Cloudflare Workers. It doesn't change any application code,
// which is what keeps this project portable to Vercel or any other
// Next.js host later — you'd just stop running the cf:* scripts.
export default defineCloudflareConfig({});
