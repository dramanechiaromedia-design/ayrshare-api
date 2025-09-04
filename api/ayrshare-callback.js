export default async function handler(req, res) {
  // This handles the redirect after user connects accounts
  const { clientId, status } = req.query;
  
  // Redirect back to your Softr site
  const redirectUrl = status === 'success' 
    ? `https://your-softr-site.com/success?connected=true&clientId=${clientId}`
    : `https://your-softr-site.com/success?connected=false`;
    
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}
