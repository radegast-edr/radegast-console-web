# Radegast EDR - Web Console

Radegast EDR Web Console is the user-facing web dashboard built with **SvelteKit** and styled with **Bootstrap 5**. It provides real-time alerts management, cryptographic age-key storage/transfer operations, device management, and policy distribution capabilities.

## Key Features

1. **Dashboard Overview**: Summary of registered devices, active teams, device groups, and a reactive card highlighting real-time unread alert counts.
2. **Alerts Management**:
   - Paginated display of security alerts (100 per page).
   - In-browser decryption of logs using age-wasm.
   - Automatically pretty-prints JSON payloads.
   - Click to mark alerts as seen/read.
   - Red badges highlighting unsigned alerts or devices.
3. **Devices & Groups Administration**: Add/delete/rename endpoints, assign devices to groups, manage team access.
4. **Key Management**:
   - Automatic generation of active & recovery keys on first login.
   - Key transfer mechanics between different browser sessions using secure ephemeral tunnels.
   - Backup/recovery workflows.

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version >= 18) installed.

### Installation

1. Navigate to the `web` directory:
   ```bash
   cd radegast-console-web
   ```
2. Install npm packages:
   ```bash
   npm install
   ```

### Configuration

Create or modify the `.env` file in the `web` folder to set the backend URL:
```env
PUBLIC_BACKEND_URL=http://localhost:8000
```

### Running Development Server

Start Vite dev server:
```bash
npm run dev
```
The application will be available at [http://localhost:5173](http://localhost:5173) by default.

### Production Build

Generate the static build using:
```bash
npm run build
```
The compiled static pages will be generated inside the `build` directory, ready to be hosted by any web server or distributed assets path.
