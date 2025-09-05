import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { clientId, profileKey } = req.body;
    
    if (!clientId || !profileKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and Profile Key required' 
      });
    }
    
    const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profileKey
      }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const hasConnections = profileData.activeSocialAccounts && 
                            profileData.activeSocialAccounts.length > 0;
      
      if (hasConnections) {
        await supabase
          .from('user_details')
          .update({ 
            ayrshare_connected: true,
            ayrshare_connected_at: new Date().toISOString(),
            facebook_instagram_connection: 'Connected'
          })
          .eq('client_id', clientId);
        
        return res.status(200).json({
          success: true,
          connected: true,
          accounts: profileData.activeSocialAccounts
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      connected: false
    });
    
  } catch (error) {
    console.error('Error checking connection:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
