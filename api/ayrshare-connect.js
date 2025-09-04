import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS for Softr
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoviral.eu');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID required' 
      });
    }
    
    // Check if user already has Ayrshare profile
    const { data: existingUser } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('client_id', clientId)
      .single();
    
    let profile;
    
    if (existingUser?.ayrshare_profile_key) {
      // User already has a profile key
      profile = { profileKey: existingUser.ayrshare_profile_key };
    } else {
      // Create new Ayrshare profile
      const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: clientId,
          refId: clientId
        })
      });
      
      if (!profileResponse.ok) {
        // Try to get existing profile from Ayrshare
        const getProfileResponse = await fetch(`https://api.ayrshare.com/api/profiles?refId=${clientId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
          }
        });
        
        const profiles = await getProfileResponse.json();
        if (profiles.profiles && profiles.profiles.length > 0) {
          profile = profiles.profiles[0];
        } else {
          throw new Error('Could not create or find profile');
        }
      } else {
        profile = await profileResponse.json();
      }
      
      // Save profile key to Supabase
      await supabase
        .from('user_details')
        .update({ 
          ayrshare_profile_key: profile.profileKey,
          ayrshare_connected: false
        })
        .eq('client_id', clientId);
    }
    
    // Generate JWT link 
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profile.profileKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: `https://ayrshare-api.vercel.app/api/ayrshare-callback?clientId=${clientId}`,
        showFbSub: true,
        showInstagramSub: true
      })
    });
    
    const jwt = await jwtResponse.json();
    
    return res.status(200).json({
      success: true,
      linkUrl: jwt.url,
      profileKey: profile.profileKey
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
