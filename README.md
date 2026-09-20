# Kellon Webapp

Kellon is a borderless finance wallet for buying, holding, sending, receiving, withdrawing, and earning with stablecoins, local currency support, bank payouts, transaction history, and receipts.

The webapp brings crypto rails and familiar banking workflows into one wallet experience, making it easier for users to move between stablecoins and fiat across supported countries and providers.

## Features

- Wallet dashboard with local currency balances
- Buy crypto through supported payment providers
- Withdraw stablecoins to fiat bank accounts
- Send, receive, and invoice flows
- Transaction history and transaction details
- Shareable transaction receipts
- Country-aware currency and payment options
- Light and dark mode support
- Earn feature planned for integration

## Architecture

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the Kellon platform as a whole: the services it provides,
  the networks and partners it integrates, and how a flow travels across them. It covers the mobile
  app, backend, admin console and messaging bots alongside this webapp, not this repository alone.
- [STELLAR_ARCHITECTURE.md](./STELLAR_ARCHITECTURE.md) — how Kellon uses Stellar and Soroban:
  accounts and sponsored trustlines, platform-paid fees, signing, and the payment, bridge, ramp and
  yield flows that settle there.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod
- shadcn/Radix UI primitives
- Privy, Wagmi, and Viem

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs at:

```bash
http://localhost:3000
```

## Scripts

```bash
npm run dev          # Start local development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
npm run format       # Check Prettier formatting
npm run format:fix   # Fix Prettier formatting
```
