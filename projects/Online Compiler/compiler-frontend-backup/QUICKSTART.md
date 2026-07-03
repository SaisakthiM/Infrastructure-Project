# Quick Start Guide

## 1. Start Your C++ Backend

Ensure your backend is running:
```bash
cd server_new
./server  # or however you build/run it
# Backend should listen on http://localhost:8080
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Backend URL (Optional)

Default is `http://localhost:8080`.

Create `.env.local` if different:
```
VITE_API_URL=http://your-backend-url:port
```

## 4. Start Development Server

```bash
npm run dev
```

Opens at http://localhost:3000

## 5. Use the Compiler

1. **Register** - Create account with username & password
2. **Login** - Sign in with your credentials
3. **Select Language** - Choose from 6 programming languages
4. **Write Code** - Type your code in the editor
5. **Execute** - Click "Run Code" to compile and execute
6. **View Output** - See results in the right panel
7. **Check History** - Click "History" to see previous runs

## Supported Languages

- C++
- C
- Python
- Java
- JavaScript
- Go

## Features

✨ Real-time code execution
📊 Execution history with search
🔐 Secure authentication with JWT
🎨 Beautiful dark theme UI
⚡ Fast code editor

## Keyboard Shortcuts

- `Ctrl/Cmd + Enter` - Run code (if implemented in future)
- `Tab` - Indent code
- `Shift + Tab` - Unindent code

## File Structure

```
src/
├── pages/
│   ├── Login.jsx      - Auth page
│   └── Editor.jsx     - Code compiler UI
├── components/
│   ├── CodeEditor.jsx      - Input area
│   ├── OutputPanel.jsx     - Output display
│   ├── LanguageSelector.jsx - Language picker
│   └── HistoryPanel.jsx    - History modal
├── services/
│   └── api.js         - Backend API calls
├── context/
│   └── AuthContext.jsx - Auth state
└── hooks/
    └── useAuth.js     - Auth hook
```

## Troubleshooting

### Connection fails
- Check backend is running on port 8080
- Verify `VITE_API_URL` environment variable

### Authentication issues
- Clear localStorage: `localStorage.clear()`
- Re-login and try again

### Code won't execute
- Ensure code is valid for selected language
- Check compiler backend logs
- Try simpler code first

### Output is empty
- Check for compilation errors (shown in output)
- Verify language matches code syntax
- Backend might be down - check health endpoint

## Next Steps

- **Customize** - Edit colors in `tailwind.config.js`
- **Add Features** - Create new components in `src/components/`
- **Deploy** - Run `npm run build` and deploy `dist/` folder

## Backend Integration

The frontend expects these endpoints:

```
POST /register          - { username, password }
POST /login             - { username, password }
POST /code              - { language, code } (auth required)
GET /history            - (auth required)
GET /health             - Health check
```

All authenticated requests use `Authorization: Bearer <token>`

Happy Coding! 💻
