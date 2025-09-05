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
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID required' 
      });
    }
    
    console.log('Processing for clientId:', clientId);
    
    // Step 1: Check if profile already exists in Ayrshare
    let profileKey = null;
    
    // First, check Ayrshare for existing profiles
    const getProfilesResponse = await fetch('https://api.ayrshare.com/api/profiles', {
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
      }
    });
    
    if (getProfilesResponse.ok) {
      const profilesData = await getProfilesResponse.json();
      console.log('Existing profiles count:', profilesData.profiles?.length);
      
      // Find if profile already exists
      const existingProfile = profilesData.profiles?.find(p => 
        p.title === clientId || 
        p.refId === clientId ||
        p.title === `Profile_${clientId}`
      );
      
      if (existingProfile) {
        profileKey = existingProfile.profileKey;
        console.log('Found existing profile:', profileKey);
      }
    }
    
    // Step 2: If no profile exists, create new one
    if (!profileKey) {
      console.log('Creating new profile for:', clientId);
      
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
      
      const profileText = await profileResponse.text();
      console.log('Create profile response:', profileResponse.status, profileText);
      
      if (!profileResponse.ok) {
        // Parse error message
        let errorMsg = 'Could not create profile';
        try {
          const errorData = JSON.parse(profileText);
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (e) {
          errorMsg = profileText;
        }
        throw new Error(errorMsg);
      }
      
      const profile = JSON.parse(profileText);
      profileKey = profile.profileKey;
      console.log('Created new profile with key:', profileKey);
    }
    
    // Step 3: Save to database 
    if (profileKey) {
      try {
        const { error: dbError } = await supabase
          .from('user_details')
          .upsert({ 
            client_id: clientId,
            ayrshare_profile_key: profileKey,
            ayrshare_connected: false
          }, { 
            onConflict: 'client_id' 
          });
        
        if (dbError) {
          console.log('Database update error (non-fatal):', dbError);
        }
      } catch (e) {
        console.log('Database error (continuing):', e);
      }
    }
    
    // Step 4: Generate JWT
    console.log('Generating JWT for profileKey:', profileKey);
    
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
    
    const jwtText = await jwtResponse.text();
    console.log('JWT response:', jwtResponse.status);
    
    if (!jwtResponse.ok) {
      throw new Error('JWT generation failed: ' + jwtText);
    }
    
    const jwtData = JSON.parse(jwtText);
    
    // Construct the SSO URL
    const ssoUrl = jwtData.url || `https://profile.ayrshare.com/social-accounts?domain=${DOMAIN}&jwt=${jwtData.token || jwtData.jwt}`;
    
    return res.status(200).json({
      success: true,
      linkUrl: ssoUrl,
      profileKey: profileKey
    });
    
  } catch (error) {
    console.error('Error in ayrshare-connect:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
