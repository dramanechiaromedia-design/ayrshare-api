import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { clientId, content, platforms = ['facebook', 'instagram'] } = req.body;
    
    // Get profile key from Supabase
    const { data: user } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key')
      .eq('client_id', clientId)
      .single();
    
    if (!user?.ayrshare_profile_key) {
      return res.status(400).json({
        success: false,
        error: 'User not connected to social media'
      });
    }
    
    // Post to social media
    const postResponse = await fetch('https://api.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': user.ayrshare_profile_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post: content,
        platforms: platforms
      })
    });
    
    const result = await postResponse.json();
    
    return res.status(200).json({
      success: result.status === 'success',
      data: result
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
