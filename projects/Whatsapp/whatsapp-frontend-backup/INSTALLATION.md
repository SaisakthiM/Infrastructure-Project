# Installation & Setup Guide

## System Requirements

- **Node.js**: 16 or higher
- **npm**: 8 or higher
- **Rust Backend**: Running on `http://localhost:3000`

## Complete Setup Instructions

### 1. Download & Extract Project

Extract all files from the downloaded package to your desired location.

```bash
unzip whatsapp-clone.zip
cd whatsapp-clone
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- react & react-dom
- react-router-dom
- axios
- zustand
- tailwindcss
- date-fns
- And more...

**Installation time**: 2-3 minutes depending on internet speed

### 3. Ensure Backend is Running

Before starting the frontend, make sure your Rust backend is running:

```bash
# In your backend directory
cd chatting-app
cargo run
```

You should see: `Server running on http://localhost:3000`

### 4. Start Development Server

```bash
npm run dev
```

You should see:
```
  VITE v5.0.0  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### 5. Open in Browser

Go to: **http://localhost:5173**

You should see the WhatsApp login page.

## First Time Setup

1. **Register an account**
   - Click "Register here"
   - Enter username and password
   - Click "Register"

2. **Create a chat room**
   - Click "New Chat"
   - Enter room name
   - Click "Create"

3. **Send a message**
   - Type a message
   - Press Enter or click Send
   - Watch it appear instantly!

## Configuration

### Backend URL

If your backend is on a different URL, edit `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url:3000'
```

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` if needed.

## Build for Production

### Create optimized build

```bash
npm run build
```

This creates a `/dist` folder with production-ready files.

### Preview production build

```bash
npm run preview
```

### Deploy to hosting

You can deploy the `/dist` folder to:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop `/dist` folder
- **AWS S3**: Upload `/dist` contents to S3
- **GitHub Pages**: Push to gh-pages branch
- **Any static host**: Just upload `/dist` folder

## Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check code quality
npm run lint
```

## Folder Structure

```
whatsapp-clone/
├── src/
│   ├── components/      # React components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom hooks
│   ├── services/       # API communication
│   ├── store/          # State management
│   ├── styles/         # Global styles
│   ├── App.jsx         # Main app
│   └── main.jsx        # Entry point
│
├── package.json        # Dependencies
├── vite.config.js      # Vite config
├── tailwind.config.js  # Tailwind config
├── postcss.config.js   # PostCSS config
├── index.html          # HTML template
├── README.md           # Full documentation
└── QUICKSTART.md       # Quick start guide
```

## API Endpoints

The frontend uses these endpoints from your backend:

### Authentication
```
POST   /users           Register user
POST   /login           Login user
GET    /users/{id}      Get user profile
PUT    /users/{id}      Update user
DELETE /users/{id}      Delete user
```

### Chat Rooms
```
POST   /room                    Create room
GET    /rooms?user_id={id}      List user's rooms
POST   /room/join              Join room
GET    /room/{id}/members      Get members
```

### Messages
```
WS /ws/{room_id}?token={token}  Real-time chat
```

## Troubleshooting

### npm install fails
```bash
# Clear npm cache and try again
npm cache clean --force
rm -rf node_modules
npm install
```

### Port 5173 already in use
```bash
# Use a different port
npm run dev -- --port 5174
```

### Cannot connect to backend
1. Verify backend is running: `http://localhost:3000`
2. Check backend .env file
3. Check firewall settings
4. Verify network connectivity

### WebSocket connection failed
1. Ensure JWT token is valid
2. Verify room ID is correct
3. Check browser console for errors
4. Verify backend WebSocket handler

### Import errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Testing the Connection

### Test Backend

```bash
curl http://localhost:3000
```

Should return API info or 404 (not the connection failing).

### Test Frontend

1. Open http://localhost:5173
2. Should see WhatsApp login page
3. Register an account
4. Should be able to login

### Test WebSocket

1. Login to app
2. Create a room
3. Type a message
4. Should see "Online" status in green
5. Message should appear immediately

## Development Tips

### Hot Module Reload (HMR)

Changes to files auto-refresh the browser. Just save and watch!

### Browser DevTools

Press **F12** to open DevTools:
- **Console**: See error messages
- **Network**: Monitor API calls
- **Application**: View localStorage tokens
- **Sources**: Debug JavaScript

### Debugging

Add `console.log()` statements to debug:

```javascript
console.log('User:', user)
console.log('Messages:', messages)
console.log('Connected:', isConnected)
```

### Performance

- Vite builds are very fast
- React Fast Refresh for instant updates
- Tailwind CSS purges unused styles

## Next Steps

1. ✅ Installation complete
2. ✅ Backend running
3. ✅ Frontend running
4. ✅ Tested with sample data
5. Next:
   - Customize colors
   - Add more features
   - Deploy to production
   - Share with users!

## Support

For issues:
1. Check browser console (F12)
2. Check backend logs
3. Read README.md
4. Check QUICKSTART.md
5. Verify all dependencies installed

## Environment Checklist

- [ ] Node.js 16+ installed
- [ ] npm 8+ installed
- [ ] Project files extracted
- [ ] Dependencies installed (`npm install`)
- [ ] Backend running on localhost:3000
- [ ] Dev server running (`npm run dev`)
- [ ] Frontend accessible at localhost:5173
- [ ] Can register account
- [ ] Can create room
- [ ] Can send messages

If all checked, you're ready to go! 🎉

---

**Happy coding!** 🚀
