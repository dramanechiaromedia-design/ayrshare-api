import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { userEmail, profileKey } = req.body;
    
    if (!userEmail || !profileKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and Profile Key required' 
      });
    }
    
    const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profileKey
      }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const hasConnections = profileData.activeSocialAccounts && 
                            profileData.activeSocialAccounts.length > 0;
      
      console.log('Profile check for', userEmail, '- Connected accounts:', profileData.activeSocialAccounts);
      
      if (hasConnections) {
        const { data, error } = await supabase
          .from('user_details')
          .update({ 
            ayrshare_connected: true,
            ayrshare_connected_at: new Date().toISOString(),
            facebook_instagram_connection: 'Connected'
          })
          .eq('user_email', userEmail)
          .select();
        
        if (error) {
          console.error('Update error:', error);
          return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log('Updated user:', data);
        
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
