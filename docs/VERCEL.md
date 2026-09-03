# TradeMate AI — Vercel pe online kaise rakhein

App **computer + mobile** dono pe `https://your-app.vercel.app` se chalega. API aur website same domain pe hain. Real Dhan orders **kabhi nahi** jaate.

## 1) GitHub pe code daalo

Apne computer pe (ya is folder se):

```bash
cd trademate-ai
git init
git add .
git commit -m "TradeMate AI ready for Vercel"
```

GitHub.com → New repository → push:

```bash
git remote add origin https://github.com/YOUR_USER/trademate-ai.git
git branch -M main
git push -u origin main
```

`.env` file mat push karo (gitignore mein hai). Tokens GitHub pe nahi jaane chahiye.

## 2) Vercel import

1. [vercel.com](https://vercel.com) pe login (GitHub se).
2. **Add New… → Project** → apna `trademate-ai` repo.
3. Root Directory: **./** (repo root, `apps/web` nahi).
4. Vercel `vercel.json` padh lega:
   - Build: `npm run build -w @trademate/web`
   - Output: `apps/web/dist`
   - API: `/api/*` serverless (Mumbai `bom1`)
5. **Environment Variables** (Production + Preview):

| Name | Value |
|---|---|
| `SESSION_SECRET` | 32+ random characters (required) |
| `BROKER_READ_ONLY` | `true` |
| `DHAN_CLIENT_ID` | optional — sirf tab jab UI Connect nahi use karna |
| `DHAN_ACCESS_TOKEN` | optional, 24h token. **Kabhi `VITE_` prefix mat do** |

`SESSION_SECRET` generate:

```bash
openssl rand -base64 32
```

6. **Deploy**.

## 3) Check

- Site: `https://your-app.vercel.app`
- Health: `https://your-app.vercel.app/api/health`
- Settings → Connect DhanHQ (read-only)
- Phone Chrome/Safari mein wahi URL → Add to Home Screen

## CLI se (bina GitHub ke)

```bash
npm i -g vercel
cd trademate-ai
npx vercel login
npx vercel --prod
```

Pehli baar project link puchega. Env vars dashboard se set karo, phir dubara deploy.

## Yaad rahe

- Hobby plan pe function ~10s. Dhan quotes usme fit hote hain.
- Dhan token 24h baad expire — Settings se naya token.
- Option premium **DEMO** rehta hai (live option-chain nahi).
- TradeMate **place/modify/cancel order nahi** karta. Real trade official Dhan app mein.
