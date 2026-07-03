# Online Code Compiler - React Frontend

A professional web-based code compiler frontend built with React, Tailwind CSS, and Vite. Execute code in multiple programming languages with real-time output and execution history.

## Features

✨ **Multi-Language Support** - C++, C, Python, Java, JavaScript, Go
🔐 **Secure Authentication** - User registration and login with JWT tokens
⚡ **Real-time Code Execution** - Execute code and see instant results
📊 **Execution History** - View and reuse previous code executions
🎨 **Beautiful UI** - Dark theme optimized for code editing
📱 **Responsive Design** - Works seamlessly on desktop and tablet

## Project Structure

```
src/
├── pages/              # Page components
│   ├── Login.jsx       # Authentication page
│   └── Editor.jsx      # Main code editor interface
├── components/         # Reusable UI components
│   ├── CodeEditor.jsx  # Code input area
│   ├── OutputPanel.jsx # Execution output display
│   ├── LanguageSelector.jsx # Language dropdown
│   └── HistoryPanel.jsx # Execution history modal
├── context/
│   └── AuthContext.jsx # Global auth state
├── hooks/
│   └── useAuth.js      # Auth custom hook
├── services/
│   └── api.js          # API calls to backend
├── App.jsx             # Main app with routing
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## Setup Instructions

### Prerequisites
- Node.js 16+ installed
- C++ Compiler backend running on `http://localhost:8080`

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure backend URL (Optional)**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   ```
   VITE_API_URL=http://localhost:8080
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

4. **Build for production**
   ```bash
   npm run build
   ```

## API Endpoints Used

The frontend communicates with the C++ backend:

### Authentication
- `POST /register` - Create new account
- `POST /login` - Login & get JWT token

### Code Execution
- `POST /code` - Execute code (requires Bearer token)
  - Request: `{ language: string, code: string }`
  - Response: `{ status: string, output: string, exitCode: number }`

### History
- `GET /history` - Get user's execution history (requires Bearer token)
  - Response: `{ records: [...] }`

### Health
- `GET /health` - Health check

## Key Components

### CodeEditor
- Full-width code input textarea
- Monospace font for code visibility
- Automatic token management in headers
- Tab support

### OutputPanel
- Real-time output display
- Success/error status badges
- Loading indicator
- Exit code tracking

### LanguageSelector
- Dropdown with 6 programming languages
- Instant language switching
- Selected language persists across executions

### HistoryPanel
- Searchable execution history
- Quick access to previous code
- Status and timestamp display
- Modal popup interface

## User Flow

1. **Register/Login**
   - Create account or sign in
   - JWT token stored in localStorage

2. **Select Language**
   - Choose from 6 supported languages
   - Default is C++

3. **Write Code**
   - Type code in the editor
   - Syntax highlighting via monospace font

4. **Execute**
   - Click "Run Code" button
   - Real-time output in right panel
   - Exit code indicates success/failure

5. **View History**
   - Click "History" button
   - Search previous executions
   - Click to reload code

## Styling

Custom color scheme optimized for code editing:
- Primary: `#2196F3` (Blue accent)
- Success: `#4CAF50` (Green)
- Error: `#F44336` (Red)
- Background: `#0F1419` (Dark)
- Code: `#1E1E1E` (VS Code dark)

## Environment Variables

Create `.env.local`:

```
VITE_API_URL=http://localhost:8080
```

## Development Tips

- **Hot Module Replacement**: Changes reflect instantly
- **API Debugging**: Use browser DevTools Network tab
- **Code Format**: Monospace font (Fira Code) for better readability
- **Token Management**: Automatically added to all authenticated requests

## Troubleshooting

### "Connection refused" errors
- Ensure backend is running on port 8080
- Check `VITE_API_URL` in `.env.local`

### "Invalid token" errors
- Clear localStorage and re-login
- Check token expiration in backend

### Output not displaying
- Verify code execution completed
- Check browser console for errors
- Ensure language is selected correctly

## Building for Production

```bash
npm run build
```

The `dist/` folder contains optimized static files ready for deployment.

## Dependencies

- **react** ^18.2.0 - UI framework
- **react-router-dom** ^6.20.0 - Routing
- **axios** ^1.6.2 - HTTP client
- **tailwindcss** ^3.3.6 - Styling
- **vite** ^5.0.8 - Build tool

## License

MIT

## Notes

- Backend must be running for app to function
- Execution timeout managed by backend
- All code is executed server-side for security
- Token expires after 24 hours (configurable in backend)
- Output limited by server-side buffer size
