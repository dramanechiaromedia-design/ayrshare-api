import { supabase } from '../lib/supabase.js';

const PRIVATE_KEY = process.env.AYRSHARE_PRIVATE_KEY;
const DOMAIN = "id-_P6eX";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { clientId, userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email required' 
      });
    }
    
    let profileKey = null;
    
    // Check if profile already exists
    const { data: existingUser } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('user_email', userEmail)
      .maybeSingle();
    
    if (existingUser?.ayrshare_profile_key) {
      profileKey = existingUser.ayrshare_profile_key;
    } else {
      // Create new profile in Ayrshare
      const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: userEmail,
          refId: userEmail
        })
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        profileKey = profile.profileKey;
        
        // Save profile key - trigger will automatically update other fields
        await supabase
          .from('user_details')
          .update({ 
            ayrshare_profile_key: profileKey
          })
          .eq('user_email', userEmail);
      }
    }
    
    // Generate JWT
    const jwtBody = {
      domain: DOMAIN,
      privateKey: PRIVATE_KEY,
      profileKey: profileKey
    };
    
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jwtBody)
    });
    
    const jwtData = await jwtResponse.json();
    const ssoUrl = jwtData.url || `https://profile.ayrshare.com/social-accounts?domain=${DOMAIN}&jwt=${jwtData.token}`;
    
    return res.status(200).json({
      success: true,
      linkUrl: ssoUrl,
      profileKey: profileKey
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
