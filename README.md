# VOOLT Academy - Getting Started Guide

Welcome to your new Academy platform! This guide will help you navigate the setup and management of your school.

## 1. Supabase (The Database)
**Are you done?** Almost. You've created the tables, but you **MUST** run the updated SQL in `/SUPABASE_SCHEMA.md` to fix the "infinite recursion" error.
- **Where:** Go to [Supabase Dashboard](https://supabase.com) -> SQL Editor.
- **Action:** Copy everything from `/SUPABASE_SCHEMA.md` and run it. This sets up the security rules so your app can talk to the database safely.

## 2. Adding Students
There are three ways to add students:
1.  **Manual (Fastest for testing):** Go to Supabase -> Authentication -> Add User. Then go to the `profiles` table and change their `role` to 'student'.
2.  **Automation (n8n):** This is for when you start selling. When a customer pays (e.g., on Stripe), n8n will automatically create their account and send them a welcome email.
3.  **Self Sign-up:** Currently, the app has a Login page. If you want students to register themselves, we can add a "Sign Up" page.

## 3. What is `.env.example`?
It is a **template**. It tells you which "Secret Keys" the app needs to work.
- You should create a new file named `.env` (or set these in Vercel).
- Copy the contents of `.env.example` into your actual environment settings.
- Replace the placeholders with your real Supabase URL and API Key.

## 4. How to use n8n?
n8n is a separate tool (like Zapier) that connects your apps.
- **Why:** To automate the "boring" stuff (creating users, sending emails).
- **How:** You need an n8n account. You import the `n8n_workflow.json` file I provided into n8n. It will ask for your Supabase keys to perform the actions.

## 5. How to Publish to Vercel?
1.  Push your code to a **GitHub** repository.
2.  Go to [Vercel.com](https://vercel.com) and click "Add New" -> "Project".
3.  Import your GitHub repo.
4.  **Crucial:** In the "Environment Variables" section, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5.  Click "Deploy".

## 6. How to Export from here?
In the **Google AI Studio Build** interface:
- Look at the **Settings** (gear icon) or the **Export** menu in the top right.
- You can "Download as ZIP" or "Push to GitHub".

---
**Don't worry!** You've already done the hard part (building the app). Now it's just about connecting the wires. If you get stuck on a specific step, just ask!
