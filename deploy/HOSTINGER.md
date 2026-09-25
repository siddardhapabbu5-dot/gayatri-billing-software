# Gayatri on Hostinger VPS (KVM) + BigRock domain

One domain for public site + staff desk:

| URL | Purpose |
|-----|---------|
| `https://gayatriconvention.com/` | Public website |
| `https://gayatriconvention.com/staff` | Staff login → desk (address bar stays `/staff`) |

You do **not** need `app.gayatriconvention.com` (legacy visits redirect to `/staff`).

---

## 1. Remove nginx Basic Auth (popup)

On the VPS:

```bash
# Find auth lines
sudo grep -R "AuthUserFile\|AuthType Basic\|gayatri-staff.htpasswd" /etc/nginx/ 2>/dev/null

# Edit the site config (name may differ)
sudo nano /etc/nginx/sites-available/gayatriconvention.com
```

Delete or comment out:

```nginx
# AuthType Basic;
# AuthName "Staff gate";
# AuthUserFile /etc/nginx/gayatri-staff.htpasswd;
# require valid-user;
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Optional: `sudo rm /etc/nginx/gayatri-staff.htpasswd`

---

## 2. Nginx SPA + `/staff` (example)

Use the sample in `deploy/hostinger-nginx.conf`.

Essential bits:

```nginx
root /var/www/gayatri;   # folder where you upload dist/
index index.html;

location / {
  try_files $uri $uri/ /index.html;
}

# Optional API reverse-proxy if Spring Boot runs on the same VPS:
# location /api/ {
#   proxy_pass http://127.0.0.1:8080/api/;
#   proxy_set_header Host $host;
#   proxy_set_header X-Real-IP $remote_addr;
# }
```

`try_files … /index.html` makes `/staff` load the React app (not a 404).

Enable site + reload:

```bash
sudo ln -sf /etc/nginx/sites-available/gayatriconvention.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

SSL (if not already):

```bash
sudo certbot --nginx -d gayatriconvention.com -d www.gayatriconvention.com
```

---

## 3. Build frontend on your PC

In the project root (Cursor):

```bash
npm install
```

**If API is on the same VPS** and nginx proxies `/api` → leave API base empty:

```bash
npm run build
```

**If API is on Railway** (or another host):

```powershell
$env:VITE_API_BASE="https://YOUR-API.up.railway.app"
npm run build
```

Output folder: `dist/`

---

## 4. Upload to the VPS

Upload **contents of `dist/`** into the nginx `root` (e.g. `/var/www/gayatri`):

- FileZilla / Hostinger SFTP, or:

```bash
# From your PC (PowerShell / scp) — adjust user + path
scp -r dist/* root@YOUR_VPS_IP:/var/www/gayatri/
```

Also redeploy the **backend** (new roles + create-user) on Railway or the VPS.

---

## 5. BigRock DNS

Point the domain at the VPS (A record):

| Host | Type | Value |
|------|------|--------|
| `@` | A | your VPS public IP |
| `www` | A or CNAME | VPS IP or `@` |

You can **remove** the `app` subdomain later. Until then, the app redirects `app.…` → `gayatriconvention.com/staff`.

---

## 6. Test

1. `https://gayatriconvention.com/` → public site  
2. `https://gayatriconvention.com/staff` → Team sign in (no browser popup)  
3. Owner login → Settings → Users & audit → create staff  
4. Staff login → limited menus only  

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Popup username/password | Basic Auth still on — Step 1 |
| `/staff` shows 404 | Missing `try_files` → `/index.html` |
| Login “API offline” | Wrong `VITE_API_BASE` or API not running / `/api` proxy |
| Old demo accounts still visible | Old `dist` on server — rebuild and re-upload |
