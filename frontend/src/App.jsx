import { useState } from 'react'

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your AI assistant. I can help you search for hotels and make reservations. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    try {
      // Mock API Call to AI Agent
      const res = await fetch('http://localhost:3000/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isLoggedIn ? { 'X-User-Id': '123' } : {})
        },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am having trouble connecting to the server.' }]);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">LuminaHotels</div>
        <div>
          <button onClick={() => setIsLoggedIn(!isLoggedIn)} style={{ background: isLoggedIn ? 'var(--accent)' : 'var(--primary)'}}>
            {isLoggedIn ? 'Logged In (15% Discount Active)' : 'Log In'}
          </button>
        </div>
      </header>

      <section className="glass-card">
        <h2 style={{marginBottom: '1.5rem'}}>Find Your Perfect Stay</h2>
        <div className="search-form">
          <div className="input-group">
            <label>Destination</label>
            <input type="text" placeholder="e.g. Rome, Istanbul" />
          </div>
          <div className="input-group">
            <label>Check-in</label>
            <input type="date" />
          </div>
          <div className="input-group">
            <label>Check-out</label>
            <input type="date" />
          </div>
          <div className="input-group">
            <label>Guests</label>
            <input type="number" min="1" placeholder="2 adults" />
          </div>
          <div className="input-group" style={{justifyContent: 'flex-end'}}>
            <button>Search</button>
          </div>
        </div>
      </section>

      <div className="main-content">
        <div className="results">
          <h3 style={{marginBottom: '1rem'}}>Featured Destinations</h3>
          <div className="glass-card" style={{marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <h4 style={{fontSize: '1.2rem'}}>Grand Hotel Roma</h4>
              <p style={{color: 'var(--text-muted)'}}>Rome City Centre • ⭐ 4.5</p>
              {isLoggedIn && <span style={{color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold'}}>15% Discount Applied!</span>}
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>${isLoggedIn ? '212' : '250'}<span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/night</span></div>
              <button style={{padding: '0.5rem 1rem', marginTop: '0.5rem'}}>Book Now</button>
            </div>
          </div>
        </div>

        <div className="map">
          <h3 style={{marginBottom: '1rem'}}>Map View</h3>
          <div className="map-placeholder">
            [ Interactive Map Component will be rendered here ]
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <div className="glass-card chat-widget" style={{padding: 0}}>
        <div className="chat-header">
          AI Assistant
        </div>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button onClick={handleSend} style={{padding: '0.75rem 1rem'}}>Send</button>
        </div>
      </div>
    </div>
  )
}

export default App
