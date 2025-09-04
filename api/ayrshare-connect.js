import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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
    
    console.log('Processing request for clientId:', clientId);
    
    // Step 1: Check if user already has profile in database
    let profileKey = null;
    try {
      const { data } = await supabase
        .from('user_details')
        .select('ayrshare_profile_key')
        .eq('client_id', clientId)
        .single();
      
      if (data?.ayrshare_profile_key) {
        profileKey = data.ayrshare_profile_key;
        console.log('Found existing profile key in database:', profileKey);
      }
    } catch (e) {
      console.log('No profile found in database, will create new one');
    }
    
    // Step 2: If no profile key, try to get existing or create new
    if (!profileKey) {
      // First check if profile already exists
      const getProfilesResponse = await fetch('https://api.ayrshare.com/api/profiles', {
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
        }
      });
      
      if (getProfilesResponse.ok) {
        const profilesData = await getProfilesResponse.json();
        const existingProfile = profilesData.profiles?.find(p => 
          p.title === `Profile_${clientId}` || 
          p.title === clientId ||
          p.refId === clientId
        );
        
        if (existingProfile) {
          profileKey = existingProfile.profileKey;
          console.log('Found existing profile:', profileKey);
        }
      }
      
      // If still no profile, create new one
      if (!profileKey) {
        console.log('Creating new Ayrshare profile...');
        
        const createProfileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `Profile_${clientId}`
          })
        });
        
        if (createProfileResponse.ok) {
          const newProfile = await createProfileResponse.json();
          profileKey = newProfile.profileKey;
          console.log('Created new profile:', profileKey);
        } else {
          throw new Error('Could not create profile');
        }
      }
      
      // Save to database
      if (profileKey) {
        try {
          await supabase
            .from('user_details')
            .update({ 
              ayrshare_profile_key: profileKey,
              ayrshare_connected: false
            })
            .eq('client_id', clientId);
        } catch (e) {
          console.log('Failed to save to database:', e);
        }
      }
    }
    
    // Step 3: Generate JWT link - CORRECTED ENDPOINT
    console.log('Generating JWT with profileKey:', profileKey);
    
    const CALLBACK_URL = 'https://ayrshare-api.vercel.app/api/ayrshare-callback';
    
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/jwt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileKey: profileKey,
        redirectUrl: `${CALLBACK_URL}?clientId=${clientId}`,
        expiresIn: 300
      })
    });
    
    const jwtText = await jwtResponse.text();
    console.log('JWT response:', jwtText);
    
    if (!jwtResponse.ok) {
      // Try alternative method - direct link generation
      console.log('JWT failed, trying direct link generation...');
      
      const linkResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileKey: profileKey,
          privateKey: process.env.AYRSHARE_API_KEY,
          domain: 'app.ayrshare.com',
          expiresIn: 300,
          redirectUrl: `${CALLBACK_URL}?clientId=${clientId}`
        })
      });
      
      if (!linkResponse.ok) {
        const errorText = await linkResponse.text();
        throw new Error('Link generation failed: ' + errorText);
      }
      
      const linkData = await linkResponse.json();
      
      return res.status(200).json({
        success: true,
        linkUrl: linkData.url || `https://app.ayrshare.com/profiles/auth?jwt=${linkData.jwt}`,
        profileKey: profileKey
      });
    }
    
    const jwt = JSON.parse(jwtText);
    
    return res.status(200).json({
      success: true,
      linkUrl: jwt.url || `https://app.ayrshare.com/profiles/auth?jwt=${jwt.jwt}`,
      profileKey: profileKey
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
