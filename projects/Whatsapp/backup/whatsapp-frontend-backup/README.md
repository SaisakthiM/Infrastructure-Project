# WhatsApp Clone - React Frontend with Tailwind CSS

A modern, clean WhatsApp-like chat application built with React and Tailwind CSS. Designed to work seamlessly with your Rust backend.

## ✨ Features

✅ **User Authentication**
- Register new users with password validation
- Secure JWT-based login
- Auto-login from stored tokens
- Logout functionality

✅ **Real-time Messaging**
- WebSocket-based instant messaging
- Auto-reconnection handling
- Message history on connect
- Connection status indicators

✅ **Chat Rooms**
- Create new chat rooms
- Browse user's rooms
- Search functionality
- Join existing rooms
- View room members with last seen times

✅ **Modern UI**
- WhatsApp-inspired design
- Tailwind CSS for clean styling
- Responsive layout (desktop/tablet/mobile)
- Smooth animations
- Profile section at top with dropdown menu
- WhatsApp chat background pattern

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Rust backend running on `http://localhost:3000`

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open http://localhost:5173 in your browser
```

---

## 📁 Project Structure

```
whatsapp-clone/
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
├── index.html                # HTML entry point
├── .eslintrc.cjs             # Code quality rules
├── .env.example              # Environment variables
├── .gitignore                # Git ignore rules
│
└── src/
    ├── main.jsx              # React entry point
    ├── App.jsx               # Main app with routing
    ├── styles/
    │   └── index.css         # Global styles with Tailwind
    │
    ├── pages/
    │   ├── LoginPage.jsx     # User login page
    │   ├── RegisterPage.jsx  # User registration page
    │   └── ChatPage.jsx      # Main chat interface
    │
    ├── components/
    │   ├── ChatList.jsx      # Sidebar with rooms list
    │   └── ChatView.jsx      # Messages display & input
    │
    ├── hooks/
    │   └── useWebSocket.js   # WebSocket management
    │
    ├── services/
    │   └── api.js            # All backend API calls
    │
    └── store/
        └── authStore.js      # Zustand auth store
```

---

## 🔌 API Endpoints

### Authentication
- `POST /users` - Register new user
- `POST /login` - Login with credentials
- `GET /users/{userId}` - Get user profile
- `PUT /users/{userId}` - Update user profile
- `DELETE /users/{userId}` - Delete user account

### Chat Rooms
- `POST /room` - Create new room
- `GET /rooms?user_id={userId}` - Get user's rooms
- `POST /room/join` - Join an existing room
- `GET /room/{roomId}/members` - Get room members

### Messages
- `WS /ws/{roomId}?token={token}` - WebSocket for real-time messages

---

## 📦 Dependencies

### Runtime
- **react** - UI library
- **react-dom** - DOM rendering
- **react-router-dom** - Client-side routing
- **axios** - HTTP client
- **zustand** - State management
- **date-fns** - Date formatting

### Development
- **vite** - Build tool
- **tailwindcss** - Utility CSS framework
- **postcss** - CSS processing
- **autoprefixer** - CSS vendor prefixes
- **eslint** - Code quality

---

## 🎨 Customization

### Change WhatsApp Green Color

Edit `tailwind.config.js`:
```javascript
whatsapp: {
  green: '#25D366',    // Primary color
  // ... other colors
}
```

### Change Fonts

Edit `tailwind.config.js`:
```javascript
fontFamily: {
  sans: ['Your Font', 'sans-serif']
}
```

### Add Custom Styles

Edit `src/styles/index.css` and add your custom CSS or Tailwind utilities.

---

## 🚢 Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy /dist folder to Vercel, Netlify, or AWS
```

---

## 🔒 Security

- ✅ JWT-based authentication
- ✅ Token stored securely in localStorage
- ✅ Automatic token inclusion in all API requests
- ✅ Password hashing on backend
- ✅ CORS configured for backend

---

## 📱 Responsive Design

- **Desktop**: Full layout with sidebar + chat area
- **Tablet**: Optimized spacing and sizing
- **Mobile**: Single column layout with collapsible sidebar

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Ensure Rust backend is running on `http://localhost:3000`
- Check network connectivity
- Verify backend .env file

### "WebSocket connection failed"
- Verify JWT token is valid
- Check you're in the correct room
- Look at browser console for errors

### "Messages not appearing"
- Check green "Online" indicator
- Try refreshing the page
- Check browser DevTools Network tab

---

## 💡 Development Tips

1. **Hot Reload**: Changes auto-refresh while developing
2. **DevTools**: Press F12 to open browser DevTools
3. **Network Tab**: Monitor API requests in DevTools
4. **Console**: Check for JavaScript errors

---

## 🎯 Key Features by File

| File | Purpose |
|------|---------|
| `src/services/api.js` | All backend API communication |
| `src/store/authStore.js` | Authentication state management |
| `src/hooks/useWebSocket.js` | Real-time message management |
| `src/components/ChatList.jsx` | Sidebar with rooms |
| `src/components/ChatView.jsx` | Messages area with profile |
| `src/styles/index.css` | Global styles and animations |
| `tailwind.config.js` | Color scheme and theme |

---

## 📚 Architecture

### State Management
- **Zustand Store** for auth state
- **React Hooks** for component state
- **localStorage** for session persistence

### API Communication
- **Axios client** with automatic token injection
- **Error handling** with user-friendly messages
- **Request interceptors** for authentication

### Real-time Updates
- **WebSocket** for instant messaging
- **Auto-reconnection** on disconnect
- **Message queue** management

### Styling
- **Tailwind CSS** for utility classes
- **CSS variables** for theming
- **Responsive design** with breakpoints

---

## 🔄 Message Flow

1. User types message → `handleSendMessage`
2. Message sent via WebSocket → Backend
3. Backend saves to database
4. Backend broadcasts to all room members
5. WebSocket receives message → Updates state
6. React re-renders message in chat

---

## 🎓 Learning Resources

- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand](https://zustand-demo.vercel.app/)
- [Axios](https://axios-http.com)

---

## 🚀 Deployment Checklist

- [ ] Build successful: `npm run build`
- [ ] No console errors in production
- [ ] All API endpoints working
- [ ] WebSocket connecting properly
- [ ] Authentication working
- [ ] Messages persisting
- [ ] Responsive on mobile devices
- [ ] Performance acceptable

---

## 📧 Support

- Check browser console for errors (F12)
- Verify backend is running
- Test API endpoints with curl/Postman
- Check network requests in DevTools

---

## 🎉 You're Ready!

Everything is configured and ready to go. Just:

1. ✅ Install dependencies: `npm install`
2. ✅ Start dev server: `npm run dev`
3. ✅ Open http://localhost:5173
4. ✅ Register and start chatting!

---

**Happy coding! 🚀**
