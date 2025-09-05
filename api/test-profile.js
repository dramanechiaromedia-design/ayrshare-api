import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    // Get profile key from database
    const { data: userData } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('user_email', email)
      .single();
    
    if (!userData?.ayrshare_profile_key) {
      return res.status(200).json({ error: 'No profile key found' });
    }
    
    // Check profile status in Ayrshare
    const profileResponse = await fetch('https://api.ayrshare.com/api/profiles/profile', {
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': userData.ayrshare_profile_key
      }
    });
    
    const profileData = await profileResponse.json();
    
    // Check user endpoint for social accounts
    const userResponse = await fetch('https://api.ayrshare.com/api/user', {
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': userData.ayrshare_profile_key
      }
    });
    
    const userDataFromAyrshare = await userResponse.json();
    
    return res.status(200).json({
      profileKey: userData.ayrshare_profile_key,
      profile: profileData,
      user: userDataFromAyrshare,
      hasConnections: userDataFromAyrshare.activeSocialAccounts?.length > 0
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
