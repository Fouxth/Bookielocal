# BookieLocal - Lottery Ticket Entry & Accounting Application

<p align="center">
  <img src="frontend/public/favicon.svg" alt="BookieLocal Logo" width="120" />
</p>

<p align="center">
  A production-grade, internal-only lottery ticket management system with offline-first architecture, optional cloud sync, and comprehensive accounting features.
</p>

## ✨ Features

- **Ticket Entry** - Fast keyboard-first workflow for entering lottery bets
- **Number Expansion** - Automatic expansion for tod/back categories (3tod → 6 combos)
- **Blocked Numbers** - Override payout rates for specific number+category combinations
- **Real-time Totals** - Per-entry and per-bill calculations with live preview
- **Accounting Dashboard** - Gross sales, expected payouts, profit calculations
- **Per-Agent Tracking** - Breakdown by agent with detailed statistics
- **Risky Numbers Detection** - Identify numbers exceeding configurable thresholds
- **Offline-First** - Works entirely offline using IndexedDB
- **Optional Cloud Sync** - Firebase Firestore with conflict resolution
- **Export** - CSV/JSON export for tickets and summaries
- **PWA** - Installable as a Progressive Web App
- **Desktop App** - Optional Electron packaging

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bookielocal

# Copy environment configuration
cp .env.example .env

# Install dependencies
npm install

# Run development server
npm run dev
```

Open http://localhost:5173 in your browser.

**Demo Account:** `admin` / `admin123`

> ⚠️ You will be prompted to change the password on first login.

## 📦 Project Structure

```
bookielocal/
├── frontend/          # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/         # Core logic (expand, compute)
│   │   ├── store/       # Zustand state management
│   │   ├── storage/     # IndexedDB & sync layer
│   │   └── utils/       # Utilities
│   └── ...
├── backend/           # Optional Express + TypeScript API
│   └── src/
│       ├── routes/      # API endpoints
│       ├── middleware/  # Auth & validation
│       └── services/    # Business logic
├── shared/            # Shared Zod schemas
├── electron/          # Desktop app wrapper
├── tests/             # Unit & integration tests
└── docs/              # Documentation
```

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend development server |
| `npm run dev:server` | Start backend server |
| `npm run dev:all` | Start both frontend and backend |
| `npm run build` | Build frontend and backend for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run electron:dev` | Run Electron in development |
| `npm run electron:build` | Build Electron app |

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server (optional)
PORT=3001
JWT_SECRET=your-secret-key

# Firebase sync (optional)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_STORAGE_MODE=Off  # Off | PushOnly | TwoWay
```

### Firebase Sync (Optional)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Copy your config to `.env`
4. Set `VITE_STORAGE_MODE=TwoWay` for bidirectional sync

### Disable Firebase Sync

To run entirely offline without any cloud sync:
1. Keep `VITE_STORAGE_MODE=Off` in settings
2. Or don't configure any Firebase credentials

The app stores all data locally in IndexedDB and works completely offline.

## 📊 Categories

| Category | Thai Name | Digits | Expansion |
|----------|-----------|--------|-----------|
| 3top | บน 3 ตัว | 3 | 1 |
| 3tod | โต๊ด 3 ตัว | 3 | 1-6 |
| 3down | ล่าง 3 ตัว | 3 | 1 |
| 3back | กลับ 3 ตัว | 3 | 1-6 |
| 2top | บน 2 ตัว | 2 | 1 |
| 2tod | โต๊ด 2 ตัว | 2 | 1-2 |
| 2down | ล่าง 2 ตัว | 2 | 1 |
| 2back | กลับ 2 ตัว | 2 | 1-2 |

### Number Expansion Examples

- `123` with `3tod` → `123, 132, 213, 231, 312, 321` (6 combos)
- `112` with `3tod` → `112, 121, 211` (3 combos)
- `111` with `3tod` → `111` (1 combo)
- `12` with `2tod` → `12, 21` (2 combos)
- `11` with `2tod` → `11` (1 combo)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Coverage

The test suite covers:
- Number expansion for all categories
- Edge cases (repeated digits)
- Entry total calculations
- Blocked number overrides
- Ticket total aggregation
- Risky number detection

## 🔌 Backend API (Optional)

The backend is completely optional. The frontend works entirely offline.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Register user (admin only) |
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/tickets` | List tickets (with filters) |
| POST | `/api/tickets` | Create ticket |
| PUT | `/api/tickets/:id` | Update ticket (admin) |
| DELETE | `/api/tickets/:id` | Delete ticket (admin) |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings (admin) |
| GET | `/api/summary` | Get summary report |

See `docs/openapi.yaml` for full API specification.

## 📱 PWA Installation

1. Open the app in a modern browser
2. Click "Install" button in the address bar
3. The app works offline after installation

## 🖥️ Desktop App (Electron)

```bash
# Development
npm run electron:dev

# Build
npm run electron:build
```

## 🔐 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens for API authentication
- XSS prevention via React's default escaping
- CORS restricted in production
- No external exposure by default

## 📝 Data Migration

### Export Data
Settings → นำเข้า/ส่งออก → Download Backup

### Import Data
Settings → นำเข้า/ส่งออก → Select backup file

### IndexedDB → Firestore Migration
1. Export data locally
2. Configure Firebase credentials
3. Enable TwoWay sync mode
4. Data will automatically sync to Firestore

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - Internal use only. Not for public distribution.

---

<p align="center">
  Built with ❤️ for internal lottery management
</p>
