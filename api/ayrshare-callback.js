import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  console.log('Callback received with query:', req.query);
  
  const { email } = req.query;
  
  if (!email) {
    console.error('No email in callback!');
    const redirectUrl = 'https://www.autoviral.eu/video-settings?error=no-email';
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  }
  
  console.log('Updating database for email:', email);
  
  try {
    const { data, error } = await supabase
      .from('user_details')
      .update({ 
        ayrshare_connected: true,
        ayrshare_connected_at: new Date().toISOString(),
        facebook_instagram_connection: 'Connected'
      })
      .eq('user_email', email)
      .select();
    
    if (error) {
      console.error('Database update failed:', error);
      const redirectUrl = `https://www.autoviral.eu/video-settings?connected=false&error=${encodeURIComponent(error.message)}`;
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }
    
    console.log('Successfully updated:', data);
    const redirectUrl = 'https://www.autoviral.eu/video-settings?connected=true';
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
    
  } catch (e) {
    console.error('Exception:', e);
    const redirectUrl = `https://www.autoviral.eu/video-settings?connected=false&error=${encodeURIComponent(e.message)}`;
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  }
}
