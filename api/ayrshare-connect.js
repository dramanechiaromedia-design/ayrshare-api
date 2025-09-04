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
    
    // Step 2: If no profile key, create new Ayrshare profile
    if (!profileKey) {
      console.log('Creating new Ayrshare profile...');
      
      const createProfileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Profile_${clientId}` // Adding prefix to ensure uniqueness
        })
      });
      
      const profileText = await createProfileResponse.text();
      console.log('Create profile response:', profileText);
      
      if (!createProfileResponse.ok) {
        // If profile exists, get it
        console.log('Profile creation failed, trying to get existing profiles...');
        
        const getProfilesResponse = await fetch('https://api.ayrshare.com/api/profiles', {
          headers: {
            'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
          }
        });
        
        if (!getProfilesResponse.ok) {
          throw new Error('Could not get profiles');
        }
        
        const profilesData = await getProfilesResponse.json();
        console.log('All profiles:', profilesData);
        
        // Find profile with matching title
        const existingProfile = profilesData.profiles?.find(p => 
          p.title === `Profile_${clientId}` || p.title === clientId
        );
        
        if (existingProfile) {
          profileKey = existingProfile.profileKey;
          console.log('Found existing profile with key:', profileKey);
        } else {
          throw new Error('Could not find or create profile');
        }
      } else {
        const newProfile = JSON.parse(profileText);
        profileKey = newProfile.profileKey;
        console.log('Created new profile with key:', profileKey);
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
          console.log('Saved profile key to database');
        } catch (e) {
          console.log('Failed to save to database:', e);
        }
      }
    }
    
    // Step 3: Generate JWT link with the profile key
    if (!profileKey) {
      throw new Error('No profile key available');
    }
    
    console.log('Generating JWT with profileKey:', profileKey);
    
    const YOUR_VERCEL_URL = 'ayrshare-api.vercel.app'; 
    
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profileKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: `https://${YOUR_VERCEL_URL}/api/ayrshare-callback?clientId=${clientId}`,
        showFbSub: true,
        showInstagramSub: true,
        hideTitle: false,
        showUrl: true
      })
    });
    
    const jwtText = await jwtResponse.text();
    console.log('JWT response:', jwtText);
    
    if (!jwtResponse.ok) {
      throw new Error('JWT generation failed: ' + jwtText);
    }
    
    const jwt = JSON.parse(jwtText);
    
    if (!jwt.url) {
      throw new Error('No URL in JWT response');
    }
    
    console.log('Successfully generated link');
    
    return res.status(200).json({
      success: true,
      linkUrl: jwt.url,
      profileKey: profileKey,
      expiresIn: jwt.expires || 300
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
