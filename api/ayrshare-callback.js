export default async function handler(req, res) {
  // Just redirect to success page
  res.writeHead(302, { 
    Location: 'https://www.autoviral.eu/video-settings?connected=true' 
  });
  res.end();
}
