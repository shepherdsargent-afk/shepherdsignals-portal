# ShepherdSignals Portal — Deployment Guide

## What This Is
A full Next.js client portal for ShepherdSignals. Golf club clients log in to see:
- Price alerts & changes from their vendors
- Historical pricing data
- Vendor comparisons & alternatives
- Invoice upload
- Market/economic signals
- Email preferences (daily signals, weekly audit, or both)

Shepherd gets an admin dashboard to manage all clients.

---

## Step 1: Supabase Setup (Shepherd's account) ✅ PARTIALLY DONE

Your Supabase project is already created: `zsqrtnrfjxdjwqvssbtb`

**Still need to do:**
1. Go to [supabase.com](https://supabase.com) → sign in as `shepherdsargent@shepherdsignals.com`
2. Go to **SQL Editor → New Query** → paste the contents of `../portal/supabase-schema.sql` → **Run**
3. Go to **Storage → Create bucket** → name it `invoices` → set to **Public**

**Your API values (already retrieved):**
- `NEXT_PUBLIC_SUPABASE_URL` = `https://zsqrtnrfjxdjwqvssbtb.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable__aye-L8jUf8pwLGH58P_2g_Ul0DJqKn`

---

## Step 2: Resend Setup (email sending)

1. Go to [resend.com](https://resend.com) → create account with `shepherdsargent@shepherdsignals.com`
2. Add domain: `shepherdsignals.com` → follow DNS instructions in GoDaddy
3. Create an **API Key** → copy it → this is your `RESEND_API_KEY`
4. Sending email will be `signals@shepherdsignals.com`

---

## Step 3: Deploy to Vercel

1. Push this `portal-app` folder to GitHub:
   ```
   cd portal-app
   git init
   git add .
   git commit -m "Initial portal"
   git remote add origin https://github.com/shepherdsargent-afk/shepherdsignals-portal.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → sign in as `shepherdsargent@shepherdsignals.com`
3. Click **Add New Project** → import the GitHub repo
4. Add these **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://zsqrtnrfjxdjwqvssbtb.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable__aye-L8jUf8pwLGH58P_2g_Ul0DJqKn` |
   | `RESEND_API_KEY` | From Resend Step 2 |
   | `RESEND_FROM_EMAIL` | `signals@shepherdsignals.com` |
   | `NEXT_PUBLIC_APP_URL` | `https://portal.shepherdsignals.com` |
   | `SHEPHERD_ADMIN_EMAIL` | `shepherdsargent@shepherdsignals.com` |
   | `CRON_SECRET` | Any long random string (generate at [randomkeygen.com](https://randomkeygen.com)) |

5. Click **Deploy**

---

## Step 4: Connect portal.shepherdsignals.com

1. In Vercel → your project → **Settings → Domains**
2. Add `portal.shepherdsignals.com`
3. Vercel will show you a CNAME record to add
4. In GoDaddy DNS → Add record:
   - Type: `CNAME`
   - Name: `portal`
   - Value: `cname.vercel-dns.com`
5. Wait 10–30 min for DNS to propagate

---

## Step 5: Create Client Accounts

For each golf club client:

1. In Supabase → **Authentication → Users → Invite User** → enter their email
2. They'll get a magic link email to set their password
3. In Supabase SQL Editor, run:
   ```sql
   -- Get their user ID first
   select id, email from auth.users where email = 'contact@golfclub.com';

   -- Create company (or find existing one)
   insert into companies (name, slug, contact_email, plan, status)
   values ('Pebble Creek Golf Club', 'pebble-creek', 'contact@golfclub.com', 'both', 'active');

   -- Link user to company
   insert into company_users (user_id, company_id, role)
   values ('[USER_ID]', '[COMPANY_ID]', 'admin');
   ```

---

## Email Automation

Emails run automatically via Vercel Cron (defined in `vercel.json`):
- **Daily signals**: 8:00 AM every day → hits `/api/send-daily`
- **Weekly audit**: 7:00 AM every Monday → hits `/api/send-weekly`

Both routes require the `CRON_SECRET` header for security.

---

## Admin Dashboard

Shepherd accesses admin at: `https://portal.shepherdsignals.com/admin`

Only `shepherdsargent@shepherdsignals.com` can access it. Features:
- See all clients, plans, and status
- Add new companies
- Publish market signals to all portals
- View email send history

---

## Adding Price Data

When you receive an invoice, you can add price records manually in Supabase:

```sql
insert into price_records (company_id, vendor_id, product_id, price, unit, invoice_date)
values ('[ID]', '[VENDOR_ID]', '[PRODUCT_ID]', 24.99, 'case', '2025-05-25');
```

Or process uploaded client invoices in the admin panel (`/admin` → Pending Invoices).

---

## Local Development

```bash
cd portal-app
n