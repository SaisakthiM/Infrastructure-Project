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
    <div className="therapist-shell">
      <header className="therapist-head">
        <div className="therapist-id">
          <span className="therapist-icon" aria-hidden="true">🌿</span>
          <div>
            <h2 className="therapist-title">AI Wellness &amp; Therapist Support</h2>
            <p className="therapist-sub">Compassionate AI companion for citizens</p>
          </div>
        </div>
        <nav className="therapist-nav">
          <Link to="/library" className="lib-btn-link">← Document Library</Link>
          <Link to="/" className="lib-btn-link">Home</Link>
        </nav>
      </header>

      <div className="therapist-log">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`therapist-bubble therapist-bubble--${m.sender === 'user' ? 'user' : 'bot'}`}
          >
            {m.text}
          </div>
        ))}
        {isTyping && <p className="therapist-typing">AI Therapist is typing…</p>}
      </div>

      <form className="therapist-form" onSubmit={handleSend}>
        <input
          className="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Share your thoughts or questions freely..."
        />
        <button className="chat-send" type="submit" aria-label="Send">↑</button>
      </form>
    </div>
  );
}
