import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showAuth, setShowAuth] = useState(false)

  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('2026-06-01')
  const [endDate, setEndDate] = useState('2026-06-05')
  const [adults, setAdults] = useState(2)

  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(false)

  const [commentsModal, setCommentsModal] = useState({ show: false, data: null, hotelName: '' })

  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your AI assistant. I can help you search for hotels and make reservations. How can I assist you today?' }
  ])
  const [chatInput, setChatInput] = useState('')

  const API_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // If login fails, try signing up
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) alert(signUpError.message)
      else alert('Signed up successfully! Check your email to verify (or disable it in Supabase dashboard).')
    }
    setShowAuth(false)
  }

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }

  const handleSearch = async () => {
    if (!destination || !startDate || !endDate || !adults) return
    setLoading(true)
    try {
      const url = `${API_URL}/api/hotels/search?city=${destination}&startDate=${startDate}&endDate=${endDate}&adults=${adults}`
      const res = await fetch(url, { headers: getHeaders() })
      const data = await res.json()
      
      if (Array.isArray(data)) {
        setHotels(data)
      } else {
        alert("Search error: " + (data.error || "Unknown error"))
        setHotels([])
      }
    } catch (err) {
      console.error(err)
      alert("Search failed")
      setHotels([])
    }
    setLoading(false)
  }

  const handleBook = async (hotelId, roomId, basePrice) => {
    if (!session) {
      alert("Please login to book a hotel.")
      setShowAuth(true)
      return
    }
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = basePrice * requiredDays;

    try {
      const res = await fetch(`${API_URL}/api/hotels/book`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ hotelId, roomId, startDate, endDate, totalPrice })
      })
      if (res.ok) alert("Booking successful!")
      else {
        const err = await res.json()
        alert("Booking failed: " + err.error)
      }
    } catch (err) {
      console.error(err)
      alert("Booking error")
    }
  }

  const handleViewComments = async (hotelId, hotelName) => {
    try {
      const res = await fetch(`${API_URL}/api/comments/hotel/${hotelId}`)
      if (res.ok) {
        const data = await res.json()
        setCommentsModal({ show: true, data: data.graphData, hotelName })
      }
    } catch (err) {
      console.error(err)
      alert("Failed to load comments")
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatInput('')

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg, user_id: session?.user?.id || 'anonymous' })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.response || data.reply || JSON.stringify(data) }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am having trouble connecting to the server.' }])
    }
  }

  // Format Recharts data
  const getGraphData = () => {
    if (!commentsModal.data) return []
    return [
      { name: 'Cleanliness', score: commentsModal.data.temizlik || 0 },
      { name: 'Service', score: commentsModal.data.personelVeServis || 0 },
      { name: 'Facilities', score: commentsModal.data.imkanVeOzellikler || 0 },
      { name: 'Condition', score: commentsModal.data.konaklamaYerininDurumu || 0 },
      { name: 'Eco-friendly', score: commentsModal.data.cevreDostlugu || 0 }
    ]
  }

  return (
    <div className="app-container">
      <header>
        <div className="logo">LuminaHotels</div>
        <div>
          {session ? (
            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
              <span style={{color: '#10b981', fontWeight: 'bold'}}>15% Discount Active</span>
              <button onClick={handleLogout} style={{ background: 'var(--glass-border)' }}>Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}>Log In / Register</button>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      {showAuth && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '400px' }}>
            <h2>Welcome to Lumina</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit">Login / Sign Up</button>
              <button type="button" onClick={() => setShowAuth(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Comments Graph Modal */}
      {commentsModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '600px', height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>{commentsModal.hotelName} - Ratings</h3>
              <button onClick={() => setCommentsModal({ show: false, data: null })} style={{ background: 'transparent', padding: '0 0.5rem' }}>X</button>
            </div>
            <div style={{ flex: 1, width: '100%' }}>
              {commentsModal.data && commentsModal.data.totalCount > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getGraphData()} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" domain={[0, 10]} stroke="#fff" />
                    <YAxis dataKey="name" type="category" stroke="#fff" width={100} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff' }} />
                    <Bar dataKey="score" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No comments available for this hotel yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="glass-card">
        <h2 style={{marginBottom: '1.5rem'}}>Find Your Perfect Stay</h2>
        <div className="search-form">
          <div className="input-group">
            <label>Destination</label>
            <input type="text" placeholder="e.g. Rome, Istanbul" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Check-in</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Check-out</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Guests</label>
            <input type="number" min="1" value={adults} onChange={e => setAdults(e.target.value)} />
          </div>
          <div className="input-group" style={{justifyContent: 'flex-end'}}>
            <button onClick={handleSearch} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </div>
      </section>

      <div className="main-content">
        <div className="results">
          <h3 style={{marginBottom: '1rem'}}>Search Results</h3>
          {hotels.length === 0 && !loading && <p style={{color: 'var(--text-muted)'}}>No hotels found. Try searching for "Istanbul" or "Rome" and check your dates.</p>}
          
          {hotels.map(hotel => (
            <div key={hotel.id} className="glass-card" style={{marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{fontSize: '1.2rem'}}>{hotel.name}</h4>
                <p style={{color: 'var(--text-muted)'}}>{hotel.city} • {hotel.stars ? `⭐ ${hotel.stars}` : 'No ratings yet'}</p>
                {session && <span style={{color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold'}}>15% Discount Applied!</span>}
                <div>
                  <button onClick={() => handleViewComments(hotel.id, hotel.name)} style={{ background: 'transparent', padding: 0, color: 'var(--accent)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    View Ratings Graph
                  </button>
                </div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>
                  ${hotel.rooms && hotel.rooms.length > 0 ? hotel.rooms[0].basePrice.toFixed(2) : 'N/A'}
                  <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/night</span>
                </div>
                {hotel.rooms && hotel.rooms.length > 0 && (
                  <button onClick={() => handleBook(hotel.id, hotel.rooms[0].id, hotel.rooms[0].basePrice)} style={{padding: '0.5rem 1rem', marginTop: '0.5rem'}}>Book Now</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="map">
          <h3 style={{marginBottom: '1rem'}}>AI Assistant</h3>
          <div className="glass-card chat-widget" style={{position: 'relative', width: '100%', height: '500px', bottom: 'auto', right: 'auto', padding: 0}}>
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
                placeholder="Ask me to search or book..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button onClick={handleSendChat} style={{padding: '0.75rem 1rem'}}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
