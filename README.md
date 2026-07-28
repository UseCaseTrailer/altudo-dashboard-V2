# altudo.co Executive Dashboard v2.0

Live Asana data · AI Insights & Improvements · Vercel serverless · Dark/Light mode

## Interface

The dashboard uses an AdminLTE-inspired application shell with a dark navigation
rail, light operations workspace, responsive navigation, status indicators, and
enterprise-style cards and tables. The implementation is custom CSS and retains
the existing Asana, MCP, AI, sharing, refresh, and theme-switching behavior.

## Setup in 5 minutes

### 1. Push to GitHub
```bash
git init && git add -A && git commit -m "feat: altudo dashboard v2"
git remote add origin https://github.com/YOUR_ORG/altudo-dashboard.git
git push -u origin main
```

### 2. Deploy to Vercel
Go to vercel.com/new → Import this repo → Deploy

### 3. Add environment variables (Vercel dashboard → Settings → Environment Variables)
```
ASANA_PAT              = your_asana_personal_access_token
ASANA_WORKSPACE_GID    = 1115662927527527
ANTHROPIC_API_KEY      = sk-ant-your_key_here   (optional — enables AI features server-side)
```

### 4. Redeploy
```bash
vercel --prod
```

## Local development
```bash
npm install
cp .env.example .env.local   # fill in your tokens
vercel dev                   # → http://localhost:3000
```

## API endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/portfolios` | GET | All portfolios + projects + tasks |
| `/api/task-action` | POST | Write to Asana |
| `/api/ai` | POST | Anthropic proxy (keeps key server-side) |

## Project structure
```
altudo-dashboard/
├── api/
│   ├── portfolios.js    # Live Asana data
│   ├── task-action.js   # Asana write operations
│   ├── ai.js            # Anthropic API proxy
│   └── health.js        # Health check
├── lib/asana.js         # Asana REST helper
├── public/index.html    # Dashboard (353KB, self-contained)
├── .env.example
├── vercel.json
└── package.json
```
