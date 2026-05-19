const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zznqxerfauashpaogvdc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''; // Needs to be provided in .env

async function verifyWithSupabase(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY
    }
  });
  if (!response.ok) {
    throw new Error('Supabase token verification failed');
  }
  const data = await response.json();
  return { id: data.id, email: data.email };
}

/**
 * Middleware to verify token if it exists. 
 * It will not block the request if the token is missing, but will attach the user to req if valid.
 */
const verifyTokenOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = await verifyWithSupabase(token);
    } catch (err) {
      console.warn('Invalid token provided on optional auth route:', err.message);
    }
  }
  next();
};

/**
 * Middleware to require a valid token.
 * Blocks the request with 401/403 if invalid or missing.
 */
const verifyTokenRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = await verifyWithSupabase(token);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};

module.exports = {
  verifyTokenOptional,
  verifyTokenRequired
};
