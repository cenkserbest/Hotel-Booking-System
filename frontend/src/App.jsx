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

  // Search State
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('2026-06-01')
  const [endDate, setEndDate] = useState('2026-06-05')
  const [adults, setAdults] = useState(2)

  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(false)

  // Modals
  const [commentsModal, setCommentsModal] = useState({ show: false, data: null, hotelName: '' })
  const [detailModal, setDetailModal] = useState({ show: false, hotel: null })
  
  // Admin Panel State
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminForm, setAdminForm] = useState({ roomId: '', startDate: '', endDate: '', totalRooms: 10 })

  // Chat State
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your AI assistant. I can help you search for hotels and make reservations. How can I assist you today?', action: null, data: null }
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
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) alert(signUpError.message)
      else alert('Signed up successfully! Check your email to verify.')
    }
    setShowAuth(false)
  }

  const handleLogout = () => {
    supabase.auth.signOut()
    setShowAdmin(false)
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

  const handleBook = async (hotelId, roomId, basePrice, sDate, eDate) => {
    if (!session) {
      alert("Please login to book a hotel.")
      setShowAuth(true)
      return
    }
    const diffTime = Math.abs(new Date(eDate) - new Date(sDate));
    const requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = basePrice * requiredDays;

    try {
      const res = await fetch(`${API_URL}/api/hotels/book`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ hotelId, roomId, startDate: sDate, endDate: eDate, totalPrice })
      })
      if (res.ok) {
        alert("Booking successful!")
        setDetailModal({ show: false, hotel: null })
      } else {
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

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    if (!session) return alert("Must be logged in as admin")
    try {
      const res = await fetch(`${API_URL}/api/admin/rooms/${adminForm.roomId}/availability`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          startDate: adminForm.startDate,
          endDate: adminForm.endDate,
          totalRooms: parseInt(adminForm.totalRooms)
        })
      })
      if (res.ok) alert("Availability updated successfully!")
      else alert("Failed to update availability")
    } catch (err) {
      alert("Error updating availability")
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
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: data.reply, action: data.action, data: data }
      ])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am having trouble connecting to the server.' }])
    }
  }

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
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
          {session && (
            <button onClick={() => setShowAdmin(!showAdmin)} style={{ background: 'var(--accent)', color: '#fff' }}>
              Admin Panel
            </button>
          )}
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

      {/* Admin Modal */}
      {showAdmin && session && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>Hotel Admin Panel</h2>
              <button onClick={() => setShowAdmin(false)} style={{ background: 'transparent' }}>X</button>
            </div>
            <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>Add/Update rooms for availability</p>
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Room ID (e.g. 1 for Rome, 2 for Istanbul)</label>
                <input type="number" required value={adminForm.roomId} onChange={e => setAdminForm({...adminForm, roomId: e.target.value})} />
              </div>
              <div style={{display: 'flex', gap: '1rem'}}>
                <div className="input-group" style={{flex: 1}}>
                  <label>Start Date</label>
                  <input type="date" required value={adminForm.startDate} onChange={e => setAdminForm({...adminForm, startDate: e.target.value})} />
                </div>
                <div className="input-group" style={{flex: 1}}>
                  <label>End Date</label>
                  <input type="date" required value={adminForm.endDate} onChange={e => setAdminForm({...adminForm, endDate: e.target.value})} />
                </div>
              </div>
              <div className="input-group">
                <label>Total Rooms (Capacity)</label>
                <input type="number" required value={adminForm.totalRooms} onChange={e => setAdminForm({...adminForm, totalRooms: e.target.value})} />
              </div>
              <button type="submit">Update Availability (DUZELT)</button>
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

      {/* Hotel Detail Modal */}
      {detailModal.show && detailModal.hotel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '800px', maxWidth: '95vw', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>{detailModal.hotel.name}</h2>
              <button onClick={() => setDetailModal({ show: false, hotel: null })} style={{ background: 'transparent' }}>X</button>
            </div>
            
            <div style={{ width: '100%', height: '300px', background: 'url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80) center/cover', borderRadius: '12px', marginBottom: '1rem' }}></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
              <div style={{ flex: 2 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '1rem' }}>📍 {detailModal.hotel.address}, {detailModal.hotel.city}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {detailModal.hotel.amenities && detailModal.hotel.amenities.map(am => (
                    <span key={am} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem' }}>{am}</span>
                  ))}
                </div>
                <button onClick={() => handleViewComments(detailModal.hotel.id, detailModal.hotel.name)} style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  View Ratings Graph
                </button>
              </div>
              
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {detailModal.hotel.rooms && detailModal.hotel.rooms.length > 0 && (
                  <>
                    <div>
                      <div style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {session && `$${detailModal.hotel.rooms[0].originalPrice?.toFixed(2) || detailModal.hotel.rooms[0].basePrice.toFixed(2)}`}
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                        ${detailModal.hotel.rooms[0].basePrice.toFixed(2)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>per night / {adults} guests</div>
                      {session && <div style={{ color: '#10b981', fontSize: '0.9rem', marginTop: '0.2rem' }}>Member Price: 15% off applied</div>}
                    </div>
                    <button 
                      onClick={() => handleBook(detailModal.hotel.id, detailModal.hotel.rooms[0].id, detailModal.hotel.rooms[0].basePrice, startDate, endDate)} 
                      style={{ padding: '1rem', fontSize: '1.1rem' }}
                    >
                      Rezervasyon Yap (Book Now)
                    </button>
                  </>
                )}
              </div>
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
            <div key={hotel.id} className="glass-card hotel-card" style={{marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: '0.2s'}} onClick={() => setDetailModal({ show: true, hotel })}>
              <div>
                <h4 style={{fontSize: '1.2rem'}}>{hotel.name}</h4>
                <p style={{color: 'var(--text-muted)'}}>{hotel.city} • {hotel.stars ? `⭐ ${hotel.stars}` : 'No ratings yet'}</p>
                {session && <span style={{color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold'}}>15% Discount Applied!</span>}
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>
                  ${hotel.rooms && hotel.rooms.length > 0 ? hotel.rooms[0].basePrice.toFixed(2) : 'N/A'}
                  <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/night</span>
                </div>
                <div style={{color: 'var(--accent)', fontSize: '0.9rem', marginTop: '0.5rem'}}>View Details &rarr;</div>
              </div>
            </div>
          ))}

          {/* Map View */}
          {destination && (
            <div className="glass-card" style={{ marginTop: '2rem', padding: '1rem' }}>
              <h3 style={{marginBottom: '1rem'}}>Haritada Göster (Map View)</h3>
              <iframe 
                width="100%" 
                height="300" 
                frameBorder="0" 
                style={{ border: 0, borderRadius: '12px' }}
                referrerPolicy="no-referrer-when-downgrade" 
                src={`https://maps.google.com/maps?q=${destination}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                allowFullScreen>
              </iframe>
            </div>
          )}
        </div>

        <div className="map">
          <h3 style={{marginBottom: '1rem'}}>AI Assistant</h3>
          <div className="glass-card chat-widget" style={{position: 'relative', width: '100%', height: '600px', bottom: 'auto', right: 'auto', padding: 0}}>
            <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '480px', overflowY: 'auto' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={`message ${m.role}`} style={{ maxWidth: '90%' }}>
                    {m.text}
                  </div>
                  
                  {/* Rich UI for AI Responses */}
                  {m.role === 'ai' && m.action === 'show_hotels' && m.data && m.data.hotels && (
                    <div style={{ marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {m.data.hotels.slice(0, 2).map(hotel => (
                        <div key={hotel.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <h5 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{hotel.name}</h5>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>📍 {hotel.city} • ⭐ {hotel.stars}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold' }}>${hotel.rooms[0].basePrice.toFixed(2)}/night</span>
                            <button 
                              onClick={() => handleBook(hotel.id, hotel.rooms[0].id, hotel.rooms[0].basePrice, m.data.searchParams.startDate, m.data.searchParams.endDate)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: 'var(--accent)' }}
                            >
                              Reserve Room
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="chat-input" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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
