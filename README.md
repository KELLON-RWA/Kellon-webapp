# Kellon Web App

Kellon is a self-custodial, multi-chain finance app that brings stablecoin wallets and familiar local-currency flows into one experience. This repository contains the Next.js web application.

Users can buy, hold, send, receive, bridge, swap, withdraw, and earn with supported assets, while keeping track of activity, balances, invoices, and tokenised-stock opportunities.

> The web app is a client of the Kellon API. It is not the authority for balances, transaction execution, authentication, MFA, or provider eligibility; those decisions must remain server-side.

## What users can do

- View a wallet dashboard, holdings, allocation, recent activity, and market movers.
- Buy stablecoins through available fiat providers and local payment methods.
- Send, receive, request, and invoice supported assets.
- Withdraw stablecoins to local currency and saved bank accounts.
- Bridge and swap assets across supported networks.
- Discover yield opportunities, deposit, and manage positions.
- Explore tokenised stocks and buy eligible listings.
- Manage profile, bank accounts, appearance, notifications, security methods, and social recovery.
- Use the app as an installable PWA where the browser supports it.

Network and provider availability is determined by the backend for the user’s country, asset, amount, and selected network. The UI must always display the backend’s current result rather than treating local mappings as financial truth.

## Supported product areas

| Area | Main flows |
| --- | --- |
| Wallet | Dashboard, assets, transaction history, notifications, receipts |
| Stablecoins | USDC and USDT purchase, custody, send, receive, and withdrawal |
| Fiat | Country-aware on-ramp, off-ramp, bank accounts, provider quotes |
| Multi-chain | Base, Polygon, BNB Chain, Celo, Arc, Solana, Stellar, and other enabled networks |
| DeFi | Yield discovery, deposits, withdrawals, positions |
| Markets | Tokenised stocks, quotes, charts, and purchase flows |
| Security | Privy authentication, backend-enforced MFA challenges, session handling, social recovery |

## Architecture

```text
Browser / PWA
    │
    ├── Next.js UI, route flows, query cache and local presentation state
    ├── Privy authentication and embedded-wallet integration
    └── API client
           │
           ▼
Kellon API
    ├── authentication, sessions, MFA and policy enforcement
    ├── provider eligibility, quotes, orders and bank payouts
    ├── wallet, transaction, bridge, swap, yield and stock services
    └── partner integrations and webhooks
```

For a wider platform view, read:

- [Platform architecture](./ARCHITECTURE.md)
- [Stellar and Soroban architecture](./STELLAR_ARCHITECTURE.md)

## Stack

- **Framework:** Next.js 15, React 19, TypeScript
- **Styling:** Tailwind CSS 4, Radix UI, shadcn-style primitives, Framer Motion
- **Data and forms:** TanStack Query, React Hook Form, Zod
- **Wallets and chains:** Privy, Wagmi, Viem, ERC-4337 utilities, LI.FI
- **Quality:** ESLint, Prettier, Vitest, TypeScript

## Project structure

```text
app/                 Next.js routes, layouts and server route handlers
components/          Product features and shared UI
  wallet/            Wallet, buy, withdraw, send, receive, bridge and swap flows
  earn/              Yield and tokenised-stock experiences
  settings/          Profile, banking and security settings
services/api/        Typed client modules for the Kellon API
hooks/               Reusable client state and flow hooks
lib/                 Chain, asset, amount, routing and display utilities
public/              PWA manifest, service worker and static assets
```

## Getting started

### Prerequisites

- Node.js 20 or later
- Yarn (the repository includes `yarn.lock`)
- Access to a compatible Kellon API environment
- A Privy application for authentication

### Install and run

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment configuration

Create `.env.local` for local development. Do not commit it.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_BACKEND_API_URL` | Yes | Base URL for the Kellon API proxy and API client |
| `NEXT_PUBLIC_API_URL` | Optional | Explicit API URL when different from the backend URL |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy application ID |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | Optional | Privy client ID, if used by the environment |
| `NEXT_PUBLIC_NETWORK_MODE` | Optional | Network mode used by chain-aware UI and transaction flows |
| `LIFI_API_ID` | Optional | Server-side LI.FI API identifier |
| `LIFI_API_KEY` | Optional | Server-side LI.FI credential |
| `FINNHUB_API_KEY` | Required for stock research | Server-side Finnhub credential for exchange quotes, company profiles, and valuation metrics |
| `ALCHEMY_RPC_KEY` | Optional | Server-side RPC configuration |
| `ANKR_RPC_KEY` | Optional | Server-side RPC configuration |
| `INFURA_RPC_KEY` | Optional | Server-side RPC configuration |

Only values intended for the browser may use the `NEXT_PUBLIC_` prefix. Never expose backend signing secrets, provider credentials, or privileged API keys through public environment variables.

## Development scripts

| Command | Description |
| --- | --- |
| `yarn dev` | Run the development server with Turbopack |
| `yarn build` | Create a production build |
| `yarn start` | Start the production server |
| `yarn lint` | Run ESLint |
| `yarn type-check` | Run TypeScript without emitting files |
| `yarn test` | Run the Vitest suite |
| `yarn test:watch` | Run Vitest in watch mode |
| `yarn format` | Check formatting with Prettier |
| `yarn format:fix` | Apply Prettier formatting |

Before opening a pull request, run:

```bash
yarn type-check
yarn lint
yarn test
yarn format
```

## Product and security boundaries

- Treat all balances, quotes, provider support, fees, limits, and transaction status as backend data.
- A transaction screen is not authorization. The API must authenticate, validate, enforce MFA where required, and revalidate every sensitive request.
- Preserve exact asset precision. Do not use JavaScript floating-point arithmetic for stablecoin limits or balances.
- Use the backend’s provider and network response as the source of truth; client-side filters are only a presentation optimisation.
- Keep sensitive browser hardening and API security changes coordinated with the backend and deployment configuration.

## Contributing

Keep changes focused, typed, and covered by the nearest relevant tests. Do not mix unrelated UI refactors with transaction, security, or provider-flow changes. For a change that affects a financial action, validate the empty, loading, error, retry, and success states on both desktop and mobile.

## License

Private and proprietary. All rights reserved.
