import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.autoviral.eu');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
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
    
    // Check if user already has Ayrshare profile
    let existingUser = null;
    try {
      const { data, error } = await supabase
        .from('user_details')
        .select('ayrshare_profile_key')
        .eq('client_id', clientId)
        .single();
      
      if (!error && data) {
        existingUser = data;
      }
    } catch (dbError) {
      console.log('Database check error (may be normal if user not found):', dbError);
    }
    
    let profile;
    
    if (existingUser?.ayrshare_profile_key) {
      console.log('User already has profile key:', existingUser.ayrshare_profile_key);
      profile = { profileKey: existingUser.ayrshare_profile_key };
    } else {
      console.log('Creating new Ayrshare profile...');
      
      // First, try to get existing profile from Ayrshare
      try {
        const getProfileResponse = await fetch(`https://api.ayrshare.com/api/profiles?refId=${clientId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
          }
        });
        
        if (getProfileResponse.ok) {
          const profiles = await getProfileResponse.json();
          console.log('Found profiles:', profiles);
          
          if (profiles.profiles && profiles.profiles.length > 0) {
            profile = profiles.profiles[0];
            console.log('Using existing Ayrshare profile');
          }
        }
      } catch (e) {
        console.log('No existing profile found, creating new one');
      }
      
      // If no existing profile, create new one
      if (!profile) {
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
          const errorText = await profileResponse.text();
          console.error('Profile creation failed:', errorText);
          throw new Error('Could not create Ayrshare profile: ' + errorText);
        }
        
        profile = await profileResponse.json();
        console.log('Created new profile:', profile);
      }
      
      // Save profile key to Supabase (don't fail if this errors)
      try {
        await supabase
          .from('user_details')
          .update({ 
            ayrshare_profile_key: profile.profileKey,
            ayrshare_connected: false
          })
          .eq('client_id', clientId);
      } catch (updateError) {
        console.log('Failed to update database, continuing anyway:', updateError);
      }
    }
    
    console.log('Generating JWT for profile:', profile.profileKey);
    
    // Generate JWT link
    const jwtResponse = await fetch('https://api.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profile.profileKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: `https://ayrshare-api.vercel.app/api/ayrshare-callback?clientId=${clientId}`, // UPDATE THIS
        showFbSub: true,
        showInstagramSub: true
      })
    });
    
    if (!jwtResponse.ok) {
      const errorText = await jwtResponse.text();
      console.error('JWT generation failed:', errorText);
      throw new Error('JWT generation failed: ' + errorText);
    }
    
    const jwt = await jwtResponse.json();
    console.log('JWT generated successfully');
    
    return res.status(200).json({
      success: true,
      linkUrl: jwt.url,
      profileKey: profile.profileKey
    });
    
  } catch (error) {
    console.error('Error in ayrshare-connect:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
