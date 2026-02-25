// Netlify Function: handles aurora alert email signups via Resend
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, location } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };
    }

    // Add contact to Resend audience
    // First, create/get the audience
    const audienceRes = await fetch('https://api.resend.com/audiences', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
    });
    
    let audienceId;
    if (audienceRes.ok) {
      const audiences = await audienceRes.json();
      const existing = audiences.data?.find(a => a.name === 'Aurora Alerts');
      if (existing) {
        audienceId = existing.id;
      }
    }

    // If no audience exists, create one
    if (!audienceId) {
      const createRes = await fetch('https://api.resend.com/audiences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'Aurora Alerts' })
      });
      if (createRes.ok) {
        const created = await createRes.json();
        audienceId = created.id;
      }
    }

    if (!audienceId) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not set up mailing list' }) };
    }

    // Add the contact
    const contactRes = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        unsubscribed: false,
        first_name: location || 'all'
      })
    });

    if (contactRes.ok) {
      // Send a welcome email
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Alaska Glow <alerts@alaskaglow.com>',
          to: email,
          subject: "You're on the aurora alert list!",
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
            <h2 style="color:#2ecc71;">Welcome to Alaska Glow Alerts</h2>
            <p>We'll email you when aurora conditions look great${location && location !== 'all' ? ' for ' + location : ' across Alaska'}.</p>
            <p>In the meantime, check tonight's forecast at <a href="https://alaskaglow.com">alaskaglow.com</a></p>
            <p style="color:#666;font-size:13px;margin-top:30px;">You're receiving this because you signed up for aurora alerts. Reply to unsubscribe.</p>
          </div>`
        })
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } else {
      const err = await contactRes.text();
      console.error('Resend contact error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not add to list' }) };
    }

  } catch (e) {
    console.error('Subscribe error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
