const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Buffer } = require('buffer');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Create images directory if it doesn't exist
const imageDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

// Generate image endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Generating image with prompt:', prompt);

    // Create FormData instance
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', 'webp');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/ultra',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
          'Accept': 'image/*',
          ...formData.getHeaders()
        },
        responseType: 'arraybuffer'
      }
    );

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `image_${timestamp}.webp`;
    const imagePath = path.join(imageDir, filename);

    // Save the image
    fs.writeFileSync(imagePath, Buffer.from(response.data));

    // Return the URL to the image
    const imageUrl = `http://localhost:${PORT}/images/${filename}`;
    
    console.log('Image generated successfully:', imageUrl);
    return res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error.response?.data ? 
      JSON.parse(Buffer.from(error.response.data).toString()) : 
      error.message);
    
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.response?.data ? JSON.parse(Buffer.from(error.response.data).toString()) : error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});