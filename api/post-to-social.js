export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { profileKey, content, platforms = ['facebook', 'instagram'] } = req.body;
    
    const postResponse = await fetch('https://api.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Profile-Key': profileKey,
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
