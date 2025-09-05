import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const { clientId, status } = req.query;
  
  console.log('Callback received:', { clientId, status });
  
  if (status === 'success' && clientId) {
    try {
      const { error } = await supabase
        .from('user_details')
        .update({ 
          ayrshare_connected: true,
          ayrshare_connected_at: new Date().toISOString(),
          facebook_instagram_connection: 'Connected'
        })
        .eq('client_id', clientId);
      
      if (error) {
        console.error('Failed to update connection status:', error);
      } else {
        console.log('Successfully updated connection status for:', clientId);
      }
    } catch (e) {
      console.error('Error updating database:', e);
    }
  }
  
  const redirectUrl = status === 'success' 
    ? `https://www.autoviral.eu/video-settings?connected=true`
    : `https://www.autoviral.eu/video-settings?connected=false`;
    
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}
