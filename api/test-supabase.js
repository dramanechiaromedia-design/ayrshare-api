import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    
    console.log('Testing Supabase connection for:', clientId);
    
    // Test 1: Read data
    const { data: readData, error: readError } = await supabase
      .from('user_details')
      .select('*')
      .eq('client_id', clientId)
      .single();
    
    if (readError) {
      console.error('Read error:', readError);
      return res.status(200).json({ 
        readError: readError.message,
        details: readError 
      });
    }
    
    // Test 2: Update data
    const { data: updateData, error: updateError } = await supabase
      .from('user_details')
      .update({ 
        ayrshare_connected: true,
        ayrshare_connected_at: new Date().toISOString(),
        facebook_instagram_connection: 'Connected'
      })
      .eq('client_id', clientId);
    
    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(200).json({ 
        readSuccess: true,
        currentData: readData,
        updateError: updateError.message 
      });
    }
    
    // Test 3: Read again to verify
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_details')
      .select('ayrshare_connected, ayrshare_connected_at, facebook_instagram_connection')
      .eq('client_id', clientId)
      .single();
    
    return res.status(200).json({
      success: true,
      before: readData,
      after: verifyData,
      updateResult: updateData
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
