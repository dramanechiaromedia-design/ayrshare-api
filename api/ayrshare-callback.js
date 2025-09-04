import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const { clientId, status } = req.query;
  
  if (status === 'success' && clientId) {
    // Update Supabase to mark as connected
    await supabase
      .from('user_details')
      .update({ 
        ayrshare_connected: true,
        ayrshare_connected_at: new Date().toISOString()
      })
      .eq('client_id', clientId);
  }
  
  // IMPORTANT: Update this with your actual Softr URL
  const redirectUrl = status === 'success' 
    ? `https://www.autoviral.eu/video-settings?connected=true`
    : `https://www.autoviral.eu/video-settings?connected=false`;
    
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}
