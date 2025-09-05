import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  console.log('Callback received with query:', req.query);
  console.log('Full URL:', req.url);
  
  const { clientId, status } = req.query;
  
  if (!clientId) {
    console.error('No clientId in callback!');
    const redirectUrl = 'https://www.autoviral.eu/video-settings?error=no-client-id';
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  }
  
  if (status === 'success') {
    console.log('Success status received, updating database for:', clientId);
    
    try {
      const { data, error } = await supabase
        .from('user_details')
        .update({ 
          ayrshare_connected: true,
          ayrshare_connected_at: new Date().toISOString(),
          facebook_instagram_connection: 'Connected'
        })
        .eq('client_id', clientId)
        .select();
      
      if (error) {
        console.error('Supabase update failed:', error);
        const redirectUrl = `https://www.autoviral.eu/video-settings?connected=false&error=${encodeURIComponent(error.message)}`;
        res.writeHead(302, { Location: redirectUrl });
        return res.end();
      }
      
      console.log('Successfully updated:', data);
      const redirectUrl = 'https://www.autoviral.eu/video-settings?connected=true';
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
      
    } catch (e) {
      console.error('Exception during update:', e);
      const redirectUrl = `https://www.autoviral.eu/video-settings?connected=false&error=${encodeURIComponent(e.message)}`;
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }
  } else {
    console.log('Non-success status:', status);
    const redirectUrl = 'https://www.autoviral.eu/video-settings?connected=false';
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  }
}
