import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { 
      userEmail,
      content, 
      platforms = ['facebook', 'instagram'],
      mediaUrls = [],
      scheduleDate 
    } = req.body;
    
    if (!userEmail || !content) {
      return res.status(400).json({
        success: false,
        error: 'Email and content are required'
      });
    }
    
    // Get user's profile key from database
    const { data: user, error: dbError } = await supabase
      .from('user_details')
      .select('ayrshare_profile_key, ayrshare_connected')
      .eq('user_email', userEmail)
      .single();
    
    if (dbError || !user) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (!user.ayrshare_connected || !user.ayrshare_profile_key) {
      return res.status(400).json({
        success: false,
        error: 'Social accounts not connected'
      });
    }
    
    // Post to social media via Ayrshare
    const postResponse = await fetch('https://api.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': user.ayrshare_profile_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post: content,
        platforms: platforms,
        mediaUrls: mediaUrls,
        scheduleDate: scheduleDate,
        autoHashtag: true,
        shortenLinks: true
      })
    });
    
    const result = await postResponse.json();
    
    if (result.status === 'success') {
      return res.status(200).json({
        success: true,
        postId: result.id,
        posts: result.postIds,
        message: 'Post published successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.errors?.[0] || 'Post failed',
        details: result
      });
    }
    
  } catch (error) {
    console.error('Error posting to social:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
