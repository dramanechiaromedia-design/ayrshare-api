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
    
    if (!clientId || !userEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and email required' 
      });
    }
    
    console.log('Processing for email:', userEmail);
    
    let profileKey = null;
    
    const { data: existingUser } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('user_email', userEmail)
      .maybeSingle();
    
    if (existingUser?.ayrshare_profile_key) {
      profileKey = existingUser.ayrshare_profile_key;
      console.log('Found existing profile key for email:', userEmail);
    } else {
      const getProfilesResponse = await fetch('https://api.ayrshare.com/api/profiles', {
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`
        }
      });
      
      if (getProfilesResponse.ok) {
        const profilesData = await getProfilesResponse.json();
        
        const existingProfile = profilesData.profiles?.find(p => 
          p.title === userEmail || 
          p.refId === userEmail
        );
        
        if (existingProfile) {
          profileKey = existingProfile.profileKey;
        }
      }
      
      if (!profileKey) {
        console.log('Creating new profile for email:', userEmail);
        
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
        } else {
          const errorText = await profileResponse.text();
          throw new Error('Could not create profile: ' + errorText);
        }
      }
      
      if (profileKey) {
        await supabase
          .from('user_details')
          .update({ 
            ayrshare_profile_key: profileKey,
            ayrshare_connected: false
          })
          .eq('user_email', userEmail);
      }
    }
    
    console.log('Generating JWT for profileKey:', profileKey);
    
    // The issue was here - Ayrshare doesn't use the redirect parameter from JWT
    // Instead, we'll handle it differently
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
    
    if (!jwtResponse.ok) {
      const errorText = await jwtResponse.text();
      throw new Error('JWT generation failed: ' + errorText);
    }
    
    const jwtData = await jwtResponse.json();
    
    const ssoUrl = jwtData.url || `https://profile.ayrshare.com/social-accounts?domain=${DOMAIN}&jwt=${jwtData.token || jwtData.jwt}`;
    
    return res.status(200).json({
      success: true,
      linkUrl: ssoUrl,
      profileKey: profileKey,
      userEmail: userEmail  // Return email for frontend use
    });
    
  } catch (error) {
    console.error('Error in ayrshare-connect:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
