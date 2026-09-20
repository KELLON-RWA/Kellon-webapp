# Kellon — Stellar Architecture

## Why Stellar

Stellar is Kellon's low-cost settlement network. Payments confirm in seconds for a fraction of a
cent, which makes it the natural rail for small remittances, bot-initiated payments, and cash
pickup — the flows where EVM gas costs would exceed the amount being sent.

Stellar is used in two layers: the **classic** network for accounts, assets and payments, and
**Soroban** (Stellar's smart contract layer) for DeFi yield and cross-chain bridging.

---

## What a user can do on Stellar

| Capability         | What the user gets                                                                             | Integrations              |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------- |
| **Wallet**         | A self-custodial Stellar account created with the rest of their wallet; no XLM needed to start | Privy embedded wallets    |
| **Send & receive** | USDC payments in seconds, fees paid by the platform                                            | Native Stellar payments   |
| **Fiat on-ramp**   | Buy USDC with local currency, settled directly on Stellar                                      | Centiiv                   |
| **Fiat off-ramp**  | Sell to a bank account, or cash pickup at a retail location                                    | Centiiv, MoneyGram        |
| **Bridge**         | Move USDC between Stellar and EVM/Solana chains natively, without wrapped assets               | Circle CCTP               |
| **Earn**           | Deposit USDC into a lending pool and track principal plus accrued yield                        | Blend (Soroban)           |
| **Payments**       | Invoices, requests and crypto gifts settled on Stellar                                         | Native + platform rails   |
| **Key export**     | Export the Stellar secret key at any time and use the account in any other wallet              | Self-custody escape hatch |

Available from the mobile app, the web wallet, and the Telegram bot.

---

## Assets

**USDC** is the transferable asset on Stellar, held as a Circle-issued classic asset. **XLM** is
the network's native asset and is used only for account reserves and fees — both of which the
platform covers on the user's behalf. Additional currencies (EURC, USDT, cNGN) are available
through ramp partners where their corridors support them.

Kellon recognises assets by issuer, not by ticker, so a look-alike token from an unknown issuer
can never be credited as USDC.

---

## What makes Stellar different

Three things about Stellar shape how Kellon integrates it. Each is handled by the platform so the
user never encounters it:

- **Accounts must be activated and opted in.** A Stellar address cannot hold USDC until it holds a
  minimum XLM reserve and has explicitly opted into the asset. Kellon sponsors both at wallet
  creation, so a new user — or a recipient who doesn't have an account yet — can be paid
  immediately. The sponsorship is reclaimable by the platform and does not affect ownership.
- **Fees are paid by the platform.** Kellon attaches its own fee account to every user
  transaction, so users transact without ever holding XLM. This is Stellar's equivalent of the gas
  sponsorship used on EVM chains.
- **Signing happens in the Privy TEE.** Stellar transactions are signed inside Privy's trusted execution environment
  after MFA, with the platform authorising the fee.

---

## Integrated platforms

**Wallet & custody** — **Privy** embedded wallets, plus a
platform-operated fee and sponsorship account.

**DeFi / yield** — **Blend**, a Soroban lending protocol. Deposits are marked to market so the
user sees principal and accrued yield separately, and the platform keeps the pool's on-chain data
alive so positions remain readable indefinitely.

**Bridges** — **Circle CCTP** USDC is burned on the source chain and minted on the destination; nothing is wrapped. The platform executes the destination-side mint so the user sees a single transfer.

**Fiat rails** — **Centiiv** settles on-ramp and off-ramp orders natively on Stellar. **MoneyGram**
connects Kellon to its retail network through Stellar's standard anchor protocols, for cash
withdrawal at a physical agent.

**Network access** — Horizon for classic payments and account history, Soroban RPC for contract
calls.

---

## How it comes together

**Receiving.** Every Stellar account is watched for incoming payments. The platform ingests
account history in bounded pages with a recorded checkpoint, so a crash or restart replays without
double-counting. Confirmed payments credit the user's balance and trigger a notification.

**Sending.** The user confirms a send, protected by MFA and policy limits → the transaction is
signed in the Privy TEE and the platform attaches the fee → it is broadcast and tracked by a
dedicated confirmation worker → balances and history update once settlement is final. Payments to
someone who doesn't have a Kellon account yet first activate and opt in the recipient's address,
then deliver the funds.

**Bridging in and out.** A transfer to another chain burns USDC on Stellar and mints it at the
destination via CCTP, with each side tracked separately and reconciled; incoming transfers are
minted on Stellar by the platform and delivered to the user's account.

**Earning.** A deposit into Blend is built by the platform and signed by the user, then recorded
and revalued continuously. Background reconciliation recovers any on-chain action that was never
recorded, so positions always converge to what actually happened on-chain.

**Cash out.** An off-ramp order locks the user's USDC, instructs the partner, and finalises the
crypto balance once fiat settlement is confirmed — bank payout through Centiiv, or a reference
code for cash pickup through MoneyGram.

---

## Security posture

- **MFA and policy checks** on every outbound transaction, with thresholds evaluated against
  platform-fetched prices rather than anything supplied by a client.
- **Issuer-verified assets** — only known issuers are credited.
- **Idempotent settlement** — every payment carries a durable identity, so retries and replays can
  never credit or debit twice.
- **Self-custodial** — the user can export their Stellar key and leave at any time.

---

## Coverage and roadmap

- **Live / integrated:** wallet and sponsored account setup, USDC payments with platform-paid fees,
  Centiiv on/off-ramp, CCTP bridging to and from EVM and Solana, Blend yield with profit tracking,
  invoices and gifts, key export.
- **Expanding:** MoneyGram cash-out coverage, additional Soroban yield markets, broader
  anchor-based corridors, and wider stablecoin support beyond USDC.
