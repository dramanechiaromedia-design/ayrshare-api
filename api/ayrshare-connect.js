import { supabase } from '../lib/supabase.js';

// Your private key from the .key file - store this in environment variable
const PRIVATE_KEY = process.env.AYRSHARE_PRIVATE_KEY;
const DOMAIN = "id-_P6eX"; // Your domain from the integration guide

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID required' 
      });
    }
    
    // Step 1: Check if user already has profile
    let profileKey = null;
    const { data: existingUser } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('client_id', clientId)
      .single();
    
    if (existingUser?.ayrshare_profile_key) {
      profileKey = existingUser.ayrshare_profile_key;
    } else {
      // Create new profile
      const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: clientId
        })
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        profileKey = profile.profileKey;
        
        // Save to database
        await supabase
          .from('user_details')
          .update({ 
            ayrshare_profile_key: profileKey,
            ayrshare_connected: false
          })
          .eq('client_id', clientId);
      } else {
        throw new Error('Could not create profile');
      }
    }
    
    // Step 2: Generate JWT with your private key and domain
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: DOMAIN,
        privateKey: PRIVATE_KEY,
        profileKey: profileKey,
        redirect: 'https://www.autoviral.eu/video-settings', 
        logout: true 
      })
    });
    
    const jwtData = await jwtResponse.json();
    
    if (!jwtData.url) {
      // Construct URL manually if not returned
      const url = `https://profile.ayrshare.com/social-accounts?domain=${DOMAIN}&jwt=${jwtData.token || jwtData.jwt}`;
      
      return res.status(200).json({
        success: true,
        linkUrl: url,
        profileKey: profileKey
      });
    }
    
    return res.status(200).json({
      success: true,
      linkUrl: jwtData.url,
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
