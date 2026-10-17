import { useState } from 'react';
import { Link } from 'react-router-dom';
import Media3DBackground from './Media3DBackground';

export default function ModernVideoHub() {
  const [videos, setVideos] = useState([
    { id: 1, title: 'Exploring District 4 Neon Alley', creator: '@cyber_drifter', views: '14.2K', likes: 1240, earnings: '₹142.00', status: 'Live' },
    { id: 2, title: 'Bank Safe Mode Explained', creator: '@sakthi_dev', views: '28.9K', likes: 3100, earnings: '₹289.00', status: 'Monetized' },
    { id: 3, title: 'Hospital VR Appointment Walkthrough', creator: '@dr_chen', views: '8.4K', likes: 920, earnings: '₹84.00', status: 'Monetized' }
  ]);

  return (
    <div style={{
      background: '#060913',
      minHeight: '100vh',
      color: '#e2e8f0',
      fontFamily: "'JetBrains Mono', 'DM Mono', monospace",
      padding: '24px 32px',
      position: 'relative'
    }}>
      <Media3DBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '20px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>🎬</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
              Mini City Stream & Media Hub
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Creator Storage, Video Streaming & Influencer Monetization Engine
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/upload" style={{
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            color: '#fff',
            textDecoration: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>
            + Upload Media
          </Link>
          <Link to="/download" style={{
            background: '#1e293b',
            color: '#cbd5e1',
            textDecoration: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            border: '1px solid #334155'
          }}>
            Download
          </Link>
        </div>
      </header>

      {/* Influencer Metrics Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{ background: '#131c2e', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Creator Views</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>51.5K</div>
        </div>
        <div style={{ background: '#131c2e', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City Payout Rate</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>₹10 / 1K Views</div>
        </div>
        <div style={{ background: '#131c2e', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Influencer Revenue</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>₹515.00</div>
        </div>
      </div>

      {/* Video Content Grid */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>Published Feeds</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {videos.map(v => (
          <div key={v.id} style={{
            background: '#131c2e',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              height: '140px',
              background: 'linear-gradient(45deg, #1e1b4b, #312e81)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}>▶️</div>
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '6px' }}>{v.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>{v.creator}</div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#cbd5e1',
                marginTop: 'auto',
                borderTop: '1px solid #1e293b',
                paddingTop: '10px'
              }}>
                <span>👁️ {v.views}</span>
                <span>❤️ {v.likes}</span>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>Earned: {v.earnings}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
