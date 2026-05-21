import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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
  const [commentsModal, setCommentsModal] = useState({ show: false, data: null, comments: [], hotelName: '', hotelId: null })
  const [adminTab, setAdminTab] = useState('availability')
  const [newHotelForm, setNewHotelForm] = useState({
    name: '', city: '', address: '', latitude: '', longitude: '', stars: 5,
    amenities: '', room: { roomType: 'Standard', basePrice: 100, capacity: 2 }
  })
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [commentForm, setCommentForm] = useState({
    commentText: '',
    ratings: { temizlik: 8, personelVeServis: 8, imkanVeOzellikler: 8, konaklamaYerininDurumu: 8, cevreDostlugu: 8 }
  })
  const [detailModal, setDetailModal] = useState({ show: false, hotel: null })
  
  // Admin Panel State
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminHotels, setAdminHotels] = useState([])
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [adminForm, setAdminForm] = useState({ startDate: '', endDate: '', totalRooms: 10, status: 'available' })

  // Chat State
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your AI assistant. I can help you search for hotels and make reservations. How can I assist you today?', action: null, data: null }
  ])
  const [chatInput, setChatInput] = useState('')

  const API_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000'
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

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
      const msg = error.message.toLowerCase()
      if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || msg.includes('wrong password') || msg.includes('email not confirmed')) {
        alert('Hatalı e-posta veya şifre.')
        return
      }
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) alert(signUpError.message)
      else alert('Kayıt başarılı! E-postanızı doğrulamak için e-postanızı kontrol edin.')
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
      const url = `${API_URL}/api/v1/hotels/search?city=${destination}&startDate=${startDate}&endDate=${endDate}&adults=${adults}`
      const res = await fetch(url, { headers: getHeaders() })
      const data = await res.json()

      if (data && Array.isArray(data.data)) {
        setHotels(data.data)
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
      const res = await fetch(`${API_URL}/api/v1/hotels/book`, {
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
      const res = await fetch(`${API_URL}/api/v1/comments/hotel/${hotelId}`)
      if (res.ok) {
        const data = await res.json()
        setCommentsModal({ show: true, data: data.graphData, comments: data.comments || [], hotelName, hotelId })
        setShowCommentForm(false)
      }
    } catch (err) {
      console.error(err)
      alert("Failed to load comments")
    }
  }

  const handleAddHotel = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/hotels`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newHotelForm.name,
          city: newHotelForm.city,
          address: newHotelForm.address,
          latitude: parseFloat(newHotelForm.latitude) || 0,
          longitude: parseFloat(newHotelForm.longitude) || 0,
          stars: parseFloat(newHotelForm.stars),
          amenities: newHotelForm.amenities.split(',').map(a => a.trim()).filter(Boolean),
          rooms: [{
            roomType: newHotelForm.room.roomType,
            basePrice: parseFloat(newHotelForm.room.basePrice),
            capacity: parseInt(newHotelForm.room.capacity)
          }]
        })
      })
      if (res.ok) {
        const hotel = await res.json()
        alert(`Hotel "${hotel.name}" created!`)
        setNewHotelForm({ name: '', city: '', address: '', latitude: '', longitude: '', stars: 5, amenities: '', room: { roomType: 'Standard', basePrice: 100, capacity: 2 } })
        fetchAdminHotels()
        setAdminTab('availability')
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to create hotel')
      }
    } catch (err) {
      alert('An error occurred')
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/api/v1/comments/add`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          hotelId: commentsModal.hotelId,
          userName: session.user.email.split('@')[0],
          commentText: commentForm.commentText,
          ratings: commentForm.ratings
        })
      })
      if (res.ok) {
        setShowCommentForm(false)
        setCommentForm({ commentText: '', ratings: { temizlik: 8, personelVeServis: 8, imkanVeOzellikler: 8, konaklamaYerininDurumu: 8, cevreDostlugu: 8 } })
        await handleViewComments(commentsModal.hotelId, commentsModal.hotelName)
      } else {
        const err = await res.json()
        alert(err.message || 'Yorum eklenemedi.')
      }
    } catch (err) {
      alert('Bir hata oluştu.')
    }
  }

  const fetchAdminHotels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/hotels`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setAdminHotels(data)
      }
    } catch (err) {
      console.error('Failed to fetch hotels for admin', err)
    }
  }

  const handleOpenAdmin = () => {
    setShowAdmin(true)
    fetchAdminHotels()
  }

  const getSelectedHotelRooms = () => {
    const hotel = adminHotels.find(h => h.id === parseInt(selectedHotelId))
    return hotel ? hotel.rooms : []
  }

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    if (!session) return alert("Must be logged in as admin")
    if (!selectedRoomId) return alert("Please select a room")
    const totalRooms = adminForm.status === 'occupied' ? 0 : parseInt(adminForm.totalRooms)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/rooms/${selectedRoomId}/availability`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          startDate: adminForm.startDate,
          endDate: adminForm.endDate,
          totalRooms
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
    const newMessages = [...messages, { role: 'user', text: userMsg }]
    setMessages(newMessages)
    setChatInput('')

    try {
      const history = newMessages.map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.text 
      }))

      const res = await fetch(`${API_URL}/api/v1/agent/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg, history: history, user_id: session?.user?.id || 'anonymous' })
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
          {isAdmin && (
            <button onClick={handleOpenAdmin} style={{ background: 'var(--accent)', color: '#fff' }}>
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
      {showAdmin && isAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2>Hotel Admin Panel</h2>
              <button onClick={() => setShowAdmin(false)} style={{ background: 'transparent' }}>X</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button type="button" onClick={() => setAdminTab('availability')} style={{ flex: 1, background: adminTab === 'availability' ? 'var(--primary)' : 'transparent', border: '1px solid var(--primary)', color: 'white' }}>
                Müsaitlik Güncelle
              </button>
              <button type="button" onClick={() => setAdminTab('addHotel')} style={{ flex: 1, background: adminTab === 'addHotel' ? 'var(--accent)' : 'transparent', border: '1px solid var(--accent)', color: 'white' }}>
                Yeni Otel Ekle
              </button>
            </div>

            {adminTab === 'addHotel' ? (
              <form onSubmit={handleAddHotel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 2 }}>
                    <label>Otel Adı</label>
                    <input type="text" required placeholder="Grand Vienna Hotel" value={newHotelForm.name} onChange={e => setNewHotelForm({...newHotelForm, name: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Yıldız</label>
                    <input type="number" min="1" max="5" step="0.5" required value={newHotelForm.stars} onChange={e => setNewHotelForm({...newHotelForm, stars: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Şehir</label>
                    <input type="text" required placeholder="Istanbul" value={newHotelForm.city} onChange={e => setNewHotelForm({...newHotelForm, city: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ flex: 2 }}>
                    <label>Adres</label>
                    <input type="text" required placeholder="Atatürk Cad. No:1" value={newHotelForm.address} onChange={e => setNewHotelForm({...newHotelForm, address: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Latitude</label>
                    <input type="number" step="any" placeholder="41.0082" value={newHotelForm.latitude} onChange={e => setNewHotelForm({...newHotelForm, latitude: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Longitude</label>
                    <input type="number" step="any" placeholder="28.9784" value={newHotelForm.longitude} onChange={e => setNewHotelForm({...newHotelForm, longitude: e.target.value})} />
                  </div>
                </div>
                <div className="input-group">
                  <label>Olanaklar (virgülle ayır)</label>
                  <input type="text" placeholder="Free Wi-Fi, Pool, Breakfast" value={newHotelForm.amenities} onChange={e => setNewHotelForm({...newHotelForm, amenities: e.target.value})} />
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>İlk Oda</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Oda Tipi</label>
                    <input type="text" required placeholder="Standard" value={newHotelForm.room.roomType} onChange={e => setNewHotelForm({...newHotelForm, room: {...newHotelForm.room, roomType: e.target.value}})} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Fiyat ($/gece)</label>
                    <input type="number" required min="1" value={newHotelForm.room.basePrice} onChange={e => setNewHotelForm({...newHotelForm, room: {...newHotelForm.room, basePrice: e.target.value}})} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Kapasite</label>
                    <input type="number" required min="1" value={newHotelForm.room.capacity} onChange={e => setNewHotelForm({...newHotelForm, room: {...newHotelForm.room, capacity: e.target.value}})} />
                  </div>
                </div>
                <button type="submit" style={{ background: 'var(--accent)' }}>Otel Ekle</button>
              </form>
            ) : (
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Hotel Selection */}
              <div className="input-group">
                <label>Otel Seçin (Select Hotel)</label>
                <select
                  required
                  value={selectedHotelId}
                  onChange={e => { setSelectedHotelId(e.target.value); setSelectedRoomId(''); }}
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '1rem' }}
                >
                  <option value="">-- Otel Seçin --</option>
                  {adminHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name} — {h.city}</option>
                  ))}
                </select>
              </div>
              {/* Room Selection */}
              {selectedHotelId && (
                <div className="input-group">
                  <label>Oda Tipi (Room Type)</label>
                  <select
                    required
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '1rem' }}
                  >
                    <option value="">-- Oda Seçin --</option>
                    {getSelectedHotelRooms().map(r => (
                      <option key={r.id} value={r.id}>{r.roomType} — ${r.basePrice}/night (Kapasite: {r.capacity})</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Dates */}
              <div style={{display: 'flex', gap: '1rem'}}>
                <div className="input-group" style={{flex: 1}}>
                  <label>Başlangıç (Start)</label>
                  <input type="date" required value={adminForm.startDate} onChange={e => setAdminForm({...adminForm, startDate: e.target.value})} />
                </div>
                <div className="input-group" style={{flex: 1}}>
                  <label>Bitiş (End)</label>
                  <input type="date" required value={adminForm.endDate} onChange={e => setAdminForm({...adminForm, endDate: e.target.value})} />
                </div>
              </div>
              {/* Dolu / Boş Toggle */}
              <div className="input-group">
                <label>Durum (Status)</label>
                <div style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="status" value="available" checked={adminForm.status === 'available'} onChange={e => setAdminForm({...adminForm, status: e.target.value})} style={{ width: 'auto', accentColor: 'var(--primary)' }} />
                    Boş (Available)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="status" value="occupied" checked={adminForm.status === 'occupied'} onChange={e => setAdminForm({...adminForm, status: e.target.value})} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                    Dolu (Occupied)
                  </label>
                </div>
              </div>
              {/* Room Count - only when Available */}
              {adminForm.status === 'available' && (
                <div className="input-group">
                  <label>Oda Adedi (Room Count)</label>
                  <input type="number" required min="1" value={adminForm.totalRooms} onChange={e => setAdminForm({...adminForm, totalRooms: e.target.value})} />
                </div>
              )}
              <button type="submit">DÜZELT (Update)</button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Comments Graph Modal */}
      {commentsModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
          <div className="glass-card" style={{ width: '700px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>{commentsModal.hotelName}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Yorumlar ve Puanlamalar</p>
              </div>
              <button onClick={() => setCommentsModal({ show: false, data: null, comments: [], hotelName: '' })} style={{ background: 'transparent', fontSize: '1.2rem', padding: '0.25rem 0.5rem' }}>✕</button>
            </div>

            {commentsModal.data && commentsModal.data.totalCount > 0 ? (
              <>
                {/* Overall Score Banner */}
                <div style={{ background: 'rgba(79,70,229,0.2)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1 }}>{commentsModal.data.overall}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>/ 10</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                      {commentsModal.data.overall >= 9 ? 'Olağanüstü' : commentsModal.data.overall >= 8 ? 'Çok İyi' : commentsModal.data.overall >= 7 ? 'İyi' : 'Orta'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{commentsModal.data.totalCount} doğrulanmış yorum</div>
                  </div>
                </div>

                {/* Category Progress Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {[
                    { label: 'Temizlik', value: commentsModal.data.temizlik },
                    { label: 'Personel ve servis', value: commentsModal.data.personelVeServis },
                    { label: 'İmkân ve özellikler', value: commentsModal.data.imkanVeOzellikler },
                    { label: 'Konaklama yerinin durumu, imkânları ve kolaylıkları', value: commentsModal.data.konaklamaYerininDurumu },
                    { label: 'Çevre dostluğu', value: commentsModal.data.cevreDostlugu },
                  ].map(cat => (
                    <div key={cat.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{cat.label}</span>
                        <span style={{ fontWeight: '600' }}>{cat.value}/10</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${(cat.value / 10) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)' }} />

                {/* Individual Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {commentsModal.comments.map((c, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1rem' }}>
                            {c.userName.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600' }}>{c.userName}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {new Date(c.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--primary)', padding: '0.3rem 0.7rem', borderRadius: '8px', fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                          {c.overallRating}/10
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>{c.commentText}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                <p>Bu otel için henüz yorum bulunmuyor.</p>
              </div>
            )}

            {/* Add Comment Section */}
            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)' }} />
            {session ? (
              showCommentForm ? (
                <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Yorum Yap</h3>
                  {[
                    { key: 'temizlik', label: 'Temizlik' },
                    { key: 'personelVeServis', label: 'Personel ve Servis' },
                    { key: 'imkanVeOzellikler', label: 'İmkân ve Özellikler' },
                    { key: 'konaklamaYerininDurumu', label: 'Konaklama Durumu' },
                    { key: 'cevreDostlugu', label: 'Çevre Dostluğu' },
                  ].map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ width: '180px', fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                      <input
                        type="range" min="1" max="10" step="1"
                        value={commentForm.ratings[key]}
                        onChange={e => setCommentForm(f => ({ ...f, ratings: { ...f.ratings, [key]: parseInt(e.target.value) } }))}
                        style={{ flex: 1, accentColor: 'var(--primary)' }}
                      />
                      <span style={{ width: '32px', textAlign: 'right', fontWeight: '700' }}>{commentForm.ratings[key]}</span>
                    </div>
                  ))}
                  <textarea
                    required
                    placeholder="Yorumunuzu yazın..."
                    value={commentForm.commentText}
                    onChange={e => setCommentForm(f => ({ ...f, commentText: e.target.value }))}
                    rows={4}
                    style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '1rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" style={{ flex: 1 }}>Gönder</button>
                    <button type="button" onClick={() => setShowCommentForm(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>İptal</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowCommentForm(true)} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                  + Yorum Yap
                </button>
              )
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Yorum yapmak için giriş yapmalısınız.</p>
            )}
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
                {detailModal.hotel.latitude && detailModal.hotel.longitude && (
                  <iframe
                    title="hotel-map"
                    width="100%"
                    height="200"
                    frameBorder="0"
                    style={{ border: 0, borderRadius: '12px', marginBottom: '1rem' }}
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${detailModal.hotel.latitude},${detailModal.hotel.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    allowFullScreen
                  />
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {detailModal.hotel.amenities && detailModal.hotel.amenities.map(am => (
                    <span key={am} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem' }}>{am}</span>
                  ))}
                </div>
                <button onClick={() => handleViewComments(detailModal.hotel.id, detailModal.hotel.name)} style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  💬 Yorumları Gör
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

        </div>

        <div className="map">
          <h3 style={{marginBottom: '1rem'}}>AI Assistant</h3>
          <div className="glass-card chat-widget" style={{position: 'relative', width: '100%', height: '600px', bottom: 'auto', right: 'auto', padding: 0, display: 'flex', flexDirection: 'column'}}>
            <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '0.5rem' }}>
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
            <div className="chat-input" style={{ position: 'relative', bottom: 'auto', left: 'auto', right: 'auto' }}>
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
