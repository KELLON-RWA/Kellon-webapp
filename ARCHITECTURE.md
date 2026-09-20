# Kellon — Platform Architecture

## What Kellon is

Kellon is a self-custodial, multi-chain crypto wallet and fiat on/off-ramp platform. It gives
users a single account that can hold stablecoins across EVM chains, Solana and Stellar; buy and
sell crypto with local currencies through regulated payment partners; move value across chains;
earn yield in DeFi; hold tokenised stocks and other real-world assets; and spend via a card —
all from a mobile app, a web app, and messaging bots (Telegram and WhatsApp).

The platform is built around **embedded wallets with account abstraction**, so users never manage
seed phrases, gas is sponsored where possible, and every sensitive action is protected by
multi-factor authentication and policy controls.

---

## Services we provide

| Service                       | What the user gets                                                                          | Key integrations                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Multi-chain wallet**        | One self-custodial account across EVM chains, Solana, and Stellar; send/receive stablecoins | Embedded wallets (Privy), account abstraction, gas sponsorship                                    |
| **Fiat on-ramp**              | Buy USDC/USDT with local currency (card, bank transfer, mobile money)                       | Centiiv, Paycrest,                                                                                |
| **Fiat off-ramp**             | Sell crypto and receive local currency in a bank account                                    | Centiiv, Paycrest, MoneyGram                                                                      |
| **Local bank accounts**       | Dedicated virtual account for fiat deposits                                                 | Fincra                                                                                            |
| **Cross-chain bridge & swap** | Move funds between chains and swap assets                                                   | Circle CCTP, Allbridge, LI.FI                                                                     |
| **Earn (DeFi yield)**         | Deposit idle stablecoins into lending/vault protocols and track positions and yield         | Aave, Morpho, Moonwell, Venus, Beefy, Mento, Stellar Blend, Kamino, Jupiter Lend, Allbridge Yield |
| **Tokenised stocks & RWA**    | Access tokenised equities / real-world assets                                               | Ondo, Luno, PancakeSwap, Base RWA venue                                                           |
| **Card**                      | Issue a virtual/physical card and spend balances                                            | Mercuryo                                                                                          |
| **Payments**                  | Send, request, invoices, and crypto gifts                                                   | Native + chain rails                                                                              |
| **Social recovery**           | Recover an account with trusted guardians if a device is lost                               | Native guardian flow                                                                              |
| **Bots**                      | Send, check balances and history from chat apps                                             | Telegram, WhatsApp Business API                                                                   |
| **Identity / compliance**     | KYC verification required for regulated flows                                               | Dojah                                                                                             |

---

## Supported networks

Kellon is chain-agnostic by design; each network exposes the capabilities that make sense on it.

| Network               | Type          | Wallet | Fiat ramps | Bridge / swap | Earn (DeFi) | Stocks/RWA |
| --------------------- | ------------- | ------ | ---------- | ------------- | ----------- | ---------- |
| **Base**              | EVM (default) | ✅     | ✅         | ✅            | ✅          | ✅         |
| **Polygon**           | EVM           | ✅     | ✅         | ✅            | ✅          | —          |
| **Celo**              | EVM           | ✅     | ✅         | ✅            | ✅          | —          |
| **BNB Smart Chain**   | EVM           | ✅     | ✅         | ✅            | ✅          | —          |
| **Solana**            | Non-EVM       | ✅     | ✅         | ✅            | ✅          | —          |
| **Stellar / Soroban** | Non-EVM       | ✅     | ✅         | ✅            | ✅          | —          |

Transferable assets are stablecoins (**USDC**, **USDT**); each network's native asset (ETH, POL,
CELO, BNB, SOL, XLM) is used for settlement and gas. Specific markets are enabled progressively
as their settlement verification is validated.

---

### Per-chain integration map

| Network               | DeFi / yield protocols                         | Bridges & swaps               | Fiat rails                             |
| --------------------- | ---------------------------------------------- | ----------------------------- | -------------------------------------- |
| **Base**              | Aave, Morpho, Moonwell, Beefy, Allbridge Yield | Circle CCTP, Allbridge, LI.FI | Centiiv, Paycrest, and global partners |
| **Polygon**           | Aave, Morpho, Beefy, Allbridge Yield           | Circle CCTP, Allbridge, LI.FI | Paycrest, global partners              |
| **BNB Smart Chain**   | Aave, Venus, Beefy, Allbridge Yield            | Allbridge, LI.FI              | Global partners                        |
| **Celo**              | Mento, Beefy, Allbridge Yield                  | Allbridge                     | Regional partners                      |
| **Solana**            | Kamino, Jupiter Lend                           | Circle CCTP, Allbridge        | Centiiv                                |
| **Stellar / Soroban** | Stellar Blend                                  | Circle CCTP                   | Centiiv                                |

Fiat coverage is driven by each partner's supported corridors and settlement networks; the
platform routes to the partner that best matches the user's currency, network, and amount.

---

## Integrated platforms, by category

**Wallet & custody**

- **Privy** — embedded wallets using a **1-of-2 key quorum** in a trusted execution environment:
  Users never see or manage seed phrases.
- **Account abstraction (ERC-4337)** with a **gas sponsorship / paymaster** layer, so users can
  transact without holding native gas and operations can be batched.

**Cards**

- **Mercuryo** — virtual and physical card issuance and management.

**DeFi / yield**

- **Aave, Morpho, Moonwell, Venus** (EVM lending & vaults), **Beefy** (multi-chain vaults),
  **Mento** (Celo), **Stellar Blend** (Stellar), **Kamino** and **Jupiter Lend** (Solana),
  **Allbridge Yield**.

**Bridges & swaps**

- **Circle CCTP** (native USDC bridging), **Allbridge** (multi-chain), **LI.FI** (aggregated
  swaps and routing on the web wallet).

**Tokenised stocks / RWA**

- Venue and data integrations across **Ondo, PancakeSwap(BSC), and Base B20 stocks**.

**Messaging & notifications**

- **Firebase Cloud Messaging** (mobile push), plus email, SMS, and outbound webhooks for
  partners.

**Bots**

- **Telegram** (Telegraf) and **WhatsApp Business API** (Coming Soon)

---

## How it comes together

Each capability is a flow that spans clients, the Core API, the wallet layer, workers, and one or
more external platforms. Four representative flows:

**Buy crypto with local currency (on-ramp).**
The user starts a purchase in the app → Core API asks the chosen ramp partner for a quote and
creates the order → the partner collects payment and settles the crypto → the partner's webhook
notifies Kellon → a worker credits the user's wallet and updates balances and history → the user
is notified.

**Send or move value across chains.**
The user confirms a send (protected by MFA) → for EVM/Solana the user-held key signs client-side
with the platform authorising gas; for Stellar the platform signs in the Privy TEE → the transaction is
broadcast → workers track confirmation and reconciliation → balances and history update on-chain
and in-app. Cross-chain transfers add a bridge step (CCTP/Allbridge) with source and destination
settlement tracked separately.

**Earn yield.**
The user picks a vault → Core API builds the deposit; the user signs → the position is recorded
and then **marked to market** continuously, so the user sees principal plus accrued yield, and
withdrawals correctly separate returned capital from profit. Guardian-style reconciliation
recovers any on-chain action that was never recorded.

**Sell crypto to a bank (off-ramp).**
The user requests a withdrawal to a bank → MFA and limits are enforced → Core API locks the
crypto and instructs the ramp/bank partner → on settlement the user's fiat account is credited and
the crypto balance is finalised.

Underpinning all flows are shared platform concerns: **multi-factor authentication and policy
checks** on sensitive actions, **request signing** between clients and the API, **idempotent
operations** so retries never double-spend, and **background reconciliation** so the platform's
records always converge to what actually happened on-chain.

---

## Custody, security & compliance posture

- **Defence in depth.** Device-bound request signing, nonce-based replay protection, per-action
  MFA/step-up, transaction thresholds, and role-scoped admin access.
- **Consistency by construction.** Financial operations carry durable identities; a reconciliation
  layer guarantees that settled on-chain activity is recorded exactly once.
- **Compliance-ready.** KYC (Dojah) and partner-driven payment flows are integrated for regulated
  on/off-ramp and card issuance.
- **Self-custodial by design.**

---

## Coverage and roadmap

- **Live / integrated:** multi-chain wallet (Base, Polygon, Celo, BNB, Solana, Stellar), fiat
  on/off-ramp partners, CCTP/Allbridge bridging, EVM lending/vault yield with profit tracking,
  tokenised stocks/RWA, cards, invoices and gifts, social recovery, Telegram/WhatsApp bots.
- **Expanding:** additional yield markets and non-EVM (Stellar/Solana) settlement verification,
  broader fiat coverage and payout corridors, additional card programmes, and richer RWA venues.
- **Design principles going forward:** chain-agnostic integrations, non-custodial key management,
  and reconciliation-first financial correctness.

---
