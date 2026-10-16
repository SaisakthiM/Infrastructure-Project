import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function TherapistSupport() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Hello, welcome to the Mini City AI Support & Therapist room. Whether you need reflection on your documents or a calm space to decompress from city life, I am here. How are you feeling today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Contextual therapeutic empathetic responses
    setTimeout(() => {
      let botResponse = "I hear you. Balancing the pace of the city and work can be demanding. Take a deep breath — what's one small thing you can do right now that brings you peace?";
      if (input.toLowerCase().includes('stress') || input.toLowerCase().includes('tired')) {
        botResponse = "It sounds like you're carrying a lot on your shoulders right now. Remember that it's okay to step back, visit the Housing district, and give yourself time to recharge.";
      } else if (input.toLowerCase().includes('money') || input.toLowerCase().includes('bank')) {
        botResponse = "Financial worries in the city can feel overwhelming. Remember that the Safe Mode ledger keeps your progress preserved, and you can earn steadily as a creator or through healthcare shifts.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: botResponse }]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '16px 24px',
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🌿</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>AI Wellness & Therapist Support</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Compassionate AI Companion for Citizens</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/library" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}>← Document Library</Link>
          <Link to="/" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.85rem' }}>Home</Link>
        </div>
      </div>

      {/* Chat Container */}
      <div style={{
        flex: 1,
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto'
      }}>
        {messages.map(m => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.sender === 'user' ? '#0284c7' : '#1e293b',
              color: '#f8fafc',
              padding: '14px 18px',
              borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              lineHeight: 1.5,
              fontSize: '0.92rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            {m.text}
          </div>
        ))}
        {isTyping && (
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
            AI Therapist is typing...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} style={{
        padding: '16px 24px',
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: '12px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Share your thoughts or questions freely..."
          style={{
            flex: 1,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '999px',
            padding: '12px 20px',
            color: '#fff',
            outline: 'none',
            fontSize: '0.9rem'
          }}
        />
        <button
          type="submit"
          style={{
            background: '#0ea5e9',
            border: 'none',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '999px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
