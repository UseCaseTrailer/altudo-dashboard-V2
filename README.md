# altudo.co Executive Dashboard v2.0

Live Asana data · AI Insights & Improvements · Vercel serverless · Dark/Light mode

## Interface

The dashboard uses an AdminLTE-inspired application shell with a dark navigation
rail, light operations workspace, responsive navigation, status indicators, and
enterprise-style cards and tables. The implementation is custom CSS and retains
the existing Asana, MCP, AI, sharing, refresh, and theme-switching behavior.

## Reporting QA improvements

- Removed malformed template content that rendered after the document.
- Normalized header portfolio, project, and task totals from the dashboard dataset.
- Replaced the misleading “just now” status with the actual snapshot date.
- Made quarter filters re-render all marketing KPIs, charts, and narratives from one dataset.
- Removed hard-coded pipeline and lead-attainment values from the executive hero.
- Replaced the portfolio-health donut with a comparison-friendly stacked bar.
- Added keyboard semantics, visible focus, activity-log state, and an accessible AI settings dialog.

## Live portfolio reporting model

The PMO executive, portfolio, and project views now use a canonical
`/api/reporting` payload generated from live Asana reads. The endpoint:

- paginates portfolio, project, task, section, and custom-field collections;
- retrieves dependencies and subtasks explicitly;
- preserves custom-field and enum-option GIDs alongside their current labels;
- detects same-label custom fields with different GIDs and does not merge them;
- returns named access failures rather than silently dropping inaccessible data;
- calculates on-time completion, throughput, lead/cycle time, overdue aging,
  milestone adherence, workload distribution, blockers, directional forecasts,
  risk ranking, and a next-best action per project;
- timestamps the pull and shares one aggregate model between executive and team
  views.

Forecasts use current remaining scope and trailing four-week throughput. They are
directional and always include a confidence label. Metrics that require history
or additional fields—baseline burndown, health trends, scope creep,
stage-to-stage cycle time, and capacity utilization—are explicitly reported as
unavailable until the required data exists.

The Marketing and Department views remain sample scenarios. They are not part of
the live PMO reporting source and should not be used as current operational
reports.

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
ASANA_PORTFOLIO_GIDS   = optional,comma-separated,portfolio-gids
ASANA_DEPARTMENT_PORTFOLIO_GIDS = optional,comma-separated,department-portfolio-gids
ASANA_PORTFOLIO_OWNER_GID = optional owner GID; defaults to me
ANTHROPIC_API_KEY      = sk-ant-your_key_here   (optional — enables AI features server-side)
```

The Department view is populated from the same canonical live reporting payload
as the PMO view. `ASANA_DEPARTMENT_PORTFOLIO_GIDS` is merged with
`ASANA_PORTFOLIO_GIDS`; it defaults to the configured Altudo department
portfolio (`1213303616045074`) for this deployment.

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
| `/api/reporting` | GET | Canonical live reporting model and data-quality report |
| `/api/portfolios` | GET | Backward-compatible alias of `/api/reporting` |
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
