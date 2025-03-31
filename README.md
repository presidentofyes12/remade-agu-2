# DAO Admin Frontend

A React-based frontend application for managing DAO operations, including admin functions, oracle integrations, and cross-chain bridging.

## Features

- Wallet Integration (MetaMask and WalletConnect)
- Admin Dashboard for managing Nostr relays and token allocations
- Oracle Dashboard for managing external data sources
- Bridge Dashboard for cross-chain asset transfers
- Privacy-preserving key management
- Secure transaction handling

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MetaMask or another Web3 wallet

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dao-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with the following variables:
```
REACT_APP_WALLET_CONNECT_PROJECT_ID=your_project_id
REACT_APP_ORACLE_API_KEY=your_oracle_api_key
```

## Development

Start the development server:
```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:3000`.

## Building for Production

Build the application for production:
```bash
npm run build
# or
yarn build
```

The production build will be created in the `build` directory.

## Project Structure

```
src/
├── components/
│   ├── admin/
│   │   └── AdminDashboard.tsx
│   ├── oracle/
│   │   └── OracleDashboard.tsx
│   └── bridge/
│       └── BridgeDashboard.tsx
├── services/
│   ├── wallet/
│   │   ├── WalletConnector.ts
│   │   ├── TransactionQueue.ts
│   │   └── KeyManager.ts
│   ├── admin/
│   │   └── AdminManager.ts
│   ├── oracle/
│   │   └── OracleService.ts
│   └── bridge/
│       └── BridgeService.ts
└── App.tsx
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 