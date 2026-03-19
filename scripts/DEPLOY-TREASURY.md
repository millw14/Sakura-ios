# Sakura Treasury Deployment

## Prerequisites

- **Anchor CLI** 0.30+ (or 0.32 to match your install)
- **Solana CLI** (solana-keygen, solana config)
- **Rust** with Solana BPF toolchain
- **Funded wallet** with SOL for deployment (~2–5 SOL on mainnet)

## Windows Note

`anchor build` has known issues on native Windows (toolchain errors). Options:

1. **Use WSL** (recommended): Install WSL, then inside WSL:
   ```bash
   cd /mnt/c/Users/1/Documents/milla\ projects/Sakura
   anchor build
   anchor deploy --program-name sakura_treasury --program-keypair target/deploy/sakura_treasury-keypair.json
   ```

2. **Use a Linux/Mac** machine or CI (e.g. GitHub Actions) to build and deploy.

## Deployment Steps

### 1. Configure Solana

```bash
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/id.json   # or your deploy wallet path
solana balance   # ensure you have enough SOL
```

### 2. Build

```bash
anchor build
```

If this fails on Windows, use WSL as above.

### 3. Deploy

```bash
anchor deploy --program-name sakura_treasury --program-keypair target/deploy/sakura_treasury-keypair.json
```

### 4. Initialize (one-time)

After deployment:

1. Open the app and go to **Admin** (`/admin`).
2. Connect with the treasury admin wallet: `5NcWtvtQ48QJcizEs9i8H7Ef3YmtmybnSkPQxA2fxFiF`
3. Ensure `NEXT_PUBLIC_ADMIN_WALLET` in `.env.local` is set to that address.
4. Click **"Initialize Treasury (run once after deploy)"**.
5. Sign the transaction.

After initialization, tips, donations, and trading fees will flow to the treasury PDA.

## Program ID

Current program ID (from keypair): `5GBAvcfjpj5XU9Y1wkubdvear2VHk6r55Bf1WjehVuV6`

This is already set in `src/lib/solana.ts`. If you deploy with a different keypair, update `SAKURA_TREASURY_PROGRAM_ID` there.

## Keypair Backup

The program keypair is in `target/deploy/sakura_treasury-keypair.json`. **Back it up securely.** If you lose it, you cannot upgrade the program.

Seed phrase (from generation):
```
brisk liquid merry bacon surge horror royal gasp afraid input tragic canvas
```
