# WhatsApp Clone - Quick Start Guide ⚡

Get running in **5 minutes**!

## Step 1: Install Dependencies (2 min)
```bash
npm install
```

## Step 2: Start Development Server (1 min)
```bash
npm run dev
```

Your app is now running at: **http://localhost:5173**

## Step 3: Test the App (2 min)
1. Click "Register here"
2. Create a test account
3. Create a chat room
4. Send a message
5. ✅ Done!

---

## 🔧 Before You Start

Make sure your Rust backend is running on `http://localhost:3000`

```bash
# In your backend directory
cargo run
```

---

## 📝 API Endpoints Used

Your frontend will use these endpoints:

### Auth
- `POST /users` - Register
- `POST /login` - Login

### Rooms
- `POST /room` - Create room
- `GET /rooms?user_id={id}` - List rooms
- `POST /room/join` - Join room
- `GET /room/{id}/members` - Get members

### Messages
- `WS /ws/{room_id}?token={token}` - Real-time chat

---

## ✨ Features Included

✅ User authentication (register/login)
✅ Real-time messaging (WebSocket)
✅ Chat rooms (create/join/list)
✅ Member management
✅ Profile section with dropdown menu
✅ WhatsApp-style background
✅ Clean modern UI with Tailwind CSS
✅ Responsive design

---

## 🎨 Customization

### Change Colors
Edit `tailwind.config.js` line 11:
```javascript
green: '#25D366',  // Change this to your color
```

### Change Font
Edit `tailwind.config.js` line 22:
```javascript
fontFamily: {
  sans: ['Your Font', 'sans-serif']
}
```

---

## 🚀 Next Steps

1. ✅ Get it running locally
2. ✅ Test with your Rust backend
3. ✅ Customize styling
4. ✅ Build: `npm run build`
5. ✅ Deploy to Vercel, Netlify, or AWS

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "npm: command not found" | Install Node.js from nodejs.org |
| "Cannot connect to backend" | Ensure Rust backend runs on localhost:3000 |
| "Port 5173 already in use" | `npm run dev -- --port 5174` |
| "WebSocket failed" | Check JWT token and room ID |

---

## 📁 Important Files

| File | Edit for |
|------|----------|
| `src/services/api.js` | Change API endpoints |
| `src/styles/index.css` | Add custom styles |
| `tailwind.config.js` | Change colors/fonts |
| `src/components/ChatView.jsx` | Modify chat UI |
| `src/components/ChatList.jsx` | Modify room list |

---

## 💡 Tips

- **Hot Reload**: Changes auto-refresh
- **DevTools**: Press F12 for debugging
- **Network Tab**: Monitor API calls
- **Console**: Check for errors

---

## 🎯 You're All Set!

Everything is configured and ready. Just run:

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and start building! 🚀

---

**Need help?** Check README.md for more details.
