# altudo.co Executive Dashboard v3.1

Live Asana data · ChatGPT insights and Q&A · Vercel serverless · Dark/Light mode

## v3.1 accessibility and Department reporting

- Keeps dashboard text readable in both light and dark modes by remapping legacy inline colors to accessible theme tokens.
- Adds a left-navigation Department dropdown with a default **General — all departments** view.
- Builds the General view from every live department portfolio while deduplicating projects by Asana GID.
- Preserves individual department drill-downs, charts, report sections, and selection state.
- Includes Complete and No Status projects in Department health charts.
- Replaces blank budget visualizations with an explicit structured-data requirement when Asana has no consistent budget fields.

## Interface

The dashboard uses a Gentelella v4-inspired application shell with a dark
navigation rail, teal reporting accents, a light operations workspace,
responsive navigation, status indicators, and enterprise-style cards and
tables. The implementation adapts Gentelella's MIT-licensed design tokens and
shell patterns while retaining the existing Asana, MCP, AI, sharing, refresh,
and theme-switching behavior. See `THIRD_PARTY_NOTICES.md`.

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

The Department view is generated from the same canonical live portfolio payload
as PMO. The Marketing view remains an explicitly labelled sample scenario and
must not be interpreted as live Asana reporting.

## UI QA fixes

- Dynamic Department portfolio and section controls now show exactly one
  selected panel.
- Portfolio and section controls expose their selected state to assistive
  technology.
- Refresh preserves the current top-level dashboard view.
- PMO shows a live loading or error state instead of briefly painting stale
  sample totals.
- Marketing quarter and date filters recalculate the full filtered view from a
  single campaign set, including KPI totals and chart periods.
- Empty marketing date ranges show an explicit no-results state.
- Project cards separate Asana-declared status from calculated execution score.
- Health distribution includes projects whose Asana status is missing.
- Long project-status narratives are summarized with an optional expandable
  detail view.

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
OPENAI_API_KEY         = sk-your_openai_key_here
OPENAI_MODEL           = gpt-5.6                (optional)
OPENAI_REASONING_EFFORT = low                   (optional)
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
| `/api/ai` | POST | Grounded OpenAI Responses API gateway (keeps key server-side) |

## Project structure
```
altudo-dashboard/
├── api/
│   ├── portfolios.js    # Live Asana data
│   ├── task-action.js   # Asana write operations
│   ├── ai.js            # OpenAI Responses API gateway
│   └── health.js        # Health check
├── lib/asana.js         # Asana REST helper
├── public/index.html    # Dashboard (353KB, self-contained)
├── .env.example
├── vercel.json
└── package.json
```

## ChatGPT portfolio intelligence

The assistant uses the same timestamped Asana reporting payload as the PMO and
Department dashboards. It supports multi-turn questions, portfolio insights,
and improvement plans while requiring metric-level source markers in its
answers. Deterministic calculations remain in `lib/reporting.js`; ChatGPT
explains those calculations and recommends actions without fabricating missing
capacity, baseline, or historical data.

The browser never receives the OpenAI key. `/api/ai` calls the Responses API
server-side with `store: false`. Set `OPENAI_MODEL` if you need to override the
default model, and test the deployment from **AI Settings → Test Connection**.
