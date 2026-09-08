# Deploy Gayatri UI on Vercel

Vercel hosts the **React website + staff desk UI** only.  
Staff **login API** still needs Railway (or local `:8080`).

## Step-by-step

### 1) Push latest code to GitHub
Make sure `main` on GitHub has your latest files (including `vercel.json`).

Repo: `https://github.com/siddardhapabbu5-dot/gayatri-billing-software`

### 2) Create Vercel account
1. Open [https://vercel.com](https://vercel.com)
2. **Sign up / Log in** with **GitHub**
3. Allow access to the `gayatri-billing-software` repo

### 3) Import project
1. Click **Add New…** → **Project**
2. Select **gayatri-billing-software**
3. Click **Import**

### 4) Build settings (usually auto)
| Setting | Value |
|--|--|
| Framework | Vite |
| Root Directory | `.` (project root) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 5) Environment variable (API)
If your Railway API is ready:

1. **Environment Variables** → Add:
   - **Name:** `VITE_API_BASE`
   - **Value:** `https://YOUR-API.up.railway.app`  
     (no slash at the end)
2. Apply to **Production** (and Preview if you want)

If API is **not** ready yet: skip this. Public site still works; staff login will show API offline until Railway is connected.

### 6) Deploy
Click **Deploy**. Wait 1–2 minutes.

### 7) Open your site
Vercel gives a URL like:
`https://gayatri-billing-software.vercel.app`

Share that with the client for the **public site / UI trial**.

### 8) (Optional) Custom domain later
Vercel → Project → **Settings** → **Domains** → add `gayatriconvention.com`

---

## After UI is live — connect API (Railway)
1. Deploy API + Postgres on Railway (`backend/`)
2. Copy API public URL
3. Set `VITE_API_BASE` on Vercel
4. **Redeploy** Vercel
5. On Railway set `APP_CORS_ORIGINS` = your Vercel URL

---

## What works on Vercel alone
- Public website  
- Staff screens UI  

## What needs Railway
- Login (`owner@…` / etc.)  
- PostgreSQL  

See also: `backend/RAILWAY.md`
