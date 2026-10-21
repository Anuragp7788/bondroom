# Deploy bondroom

## Local

```powershell
npm run dev
```

Then open `http://localhost:4173`.

## Vercel (recommended)

1. Create a clean public GitHub repository containing the files in this folder.
2. Import that repository into Vercel.
3. Keep the default framework as **Other** or **No Framework**.
4. Set the project root to the repository root.
5. Add these environment variables in Vercel if you want model-generated reads:

```text
OPENROUTER_API_KEY=your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openrouter/free
```

6. Deploy. Vercel will serve `index.html` and expose `api/profile-read.js` as `/api/profile-read`.
7. Verify:

```text
https://YOUR-DOMAIN.vercel.app/api/health
```

The response should contain `ok: true`.

## GitHub command outline

Run from this folder after creating an empty public repository:

```powershell
git init
git add .
git commit -m "feat: add bondroom agentic dating demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Do not commit `.env` or API keys. `.gitignore` already excludes them.

## Important source limitation

The backend only attempts public HTML metadata retrieval with a timeout. LinkedIn and Instagram may block automated requests or return incomplete metadata. The UI records that limitation and falls back to the two submitted handles. For a production launch, use official/permissioned APIs or an approved data provider.
