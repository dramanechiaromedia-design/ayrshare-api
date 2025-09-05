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
    
    console.log('Checking connection for:', userEmail, 'with key:', profileKey);
    
    if (!userEmail || !profileKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and Profile Key required' 
      });
    }
    
    const userResponse = await fetch('https://api.ayrshare.com/api/user', {
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profileKey
      }
    });
    
    if (!userResponse.ok) {
      console.log('Ayrshare user check failed');
      return res.status(200).json({ success: false, connected: false });
    }
    
    const userData = await userResponse.json();
    console.log('Ayrshare user data:', userData);
    
    const hasConnections = userData.activeSocialAccounts && userData.activeSocialAccounts.length > 0;
    
    if (hasConnections) {
      console.log('User has connected accounts:', userData.activeSocialAccounts);
      
      // First, check if record exists
      const { data: existing, error: selectError } = await supabase
        .from('user_details')
        .select('id, user_email')
        .eq('user_email', userEmail)
        .single();
      
      if (selectError) {
        console.error('Error finding user:', selectError);
        return res.status(200).json({
          success: false,
          error: 'User not found in database'
        });
      }
      
      console.log('Found user record:', existing);
      
      // Now update using the ID
      const { data: updateResult, error: updateError } = await supabase
        .from('user_details')
        .update({ 
          ayrshare_connected: true,
          ayrshare_connected_at: new Date().toISOString(),
          facebook_instagram_connection: 'Connected'
        })
        .eq('id', existing.id)
        .select();
      
      if (updateError) {
        console.error('Update failed:', updateError);
        return res.status(200).json({
          success: false,
          error: updateError.message
        });
      }
      
      console.log('Successfully updated:', updateResult);
      
      return res.status(200).json({
        success: true,
        connected: true,
        accounts: userData.activeSocialAccounts,
        updated: updateResult
      });
    }
    
    console.log('No connected accounts found');
    return res.status(200).json({
      success: true,
      connected: false
    });
    
  } catch (error) {
    console.error('Error in check-connection:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
