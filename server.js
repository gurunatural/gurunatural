// server.js

// 1. Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer'); // <-- ADD THIS
require('dotenv').config();

// 2. Initialize Express App
const app = express();

// 3. Middleware
app.use(cors());
// This is for parsing JSON in routes that DON'T handle file uploads.
app.use(express.json()); 

// 4. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// 5. Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('Connection error:', err));

// 6. Mongoose Schema and Model (Your schema is perfect, no changes needed)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: String,
  price: Number,
  img: String, 
  images: [String], 
  variants: [{
    size: String,
    price: Number,
    image: String 
  }]
});

const Product = mongoose.model('Product', productSchema);


// =================================================================================
// *** NEW: MULTER & CLOUDINARY SETUP FOR FILE UPLOADS ***
// =================================================================================

// Configure Multer to store files in memory as buffers
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to upload a file buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    // Use upload_stream to upload from a buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "guru_sampoorna_products" }, // Optional: A folder in your Cloudinary account
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};
// =================================================================================


// --- API ROUTES ---

// GET all products (No changes needed here)
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// =================================================================================
// *** REPLACED: The POST route now uses Multer and uploads to Cloudinary ***
// =================================================================================
app.post('/api/products', upload.any(), async (req, res) => {
    try {
        // Text fields from the form are in req.body
        const { name, category, description, price } = req.body;
        let variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        
        // Files uploaded by Multer are in req.files
        const files = req.files;
        let mainImageUrls = [];
        
        // Upload all files to Cloudinary in parallel for speed
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);

        // After all uploads are complete, map the URLs back to their fields
        uploadResults.forEach((result, index) => {
            const originalField = files[index].fieldname;
            if (originalField === 'images') {
                mainImageUrls.push(result.secure_url);
            } else if (originalField.startsWith('variant_image_')) {
                // Get the index from the field name (e.g., 'variant_image_0')
                const variantIndex = parseInt(originalField.split('_')[2]);
                if (variants[variantIndex]) {
                    variants[variantIndex].image = result.secure_url;
                }
            }
        });

        // Create the new product object with Cloudinary URLs
        const newProduct = new Product({
            name,
            category,
            description,
            images: mainImageUrls,
            price: variants.length > 0 ? undefined : price,
            variants: variants.length > 0 ? variants : undefined,
            // The 'img' field from your schema is now replaced by the 'images' array
        });

        await newProduct.save();
        res.status(201).json(newProduct);

    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error while creating product.' });
    }
});


// =================================================================================
// *** REPLACED: The PUT route also now handles file uploads for updates ***
// =================================================================================
app.put('/api/products/:id', upload.any(), async (req, res) => {
    try {
        const { name, category, description, price } = req.body;
        let variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        // The list of old image URLs to keep is sent from the frontend
        let existingImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];

        const files = req.files;
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);

        // Map the NEWLY uploaded URLs back to their original fields
        uploadResults.forEach((result, index) => {
            const originalField = files[index].fieldname;
            if (originalField === 'images') {
                existingImages.push(result.secure_url); // Add new URL to the list of main images
            } else if (originalField.startsWith('variant_image_')) {
                const variantIndex = parseInt(originalField.split('_')[2]);
                if (variants[variantIndex]) {
                    // This new image replaces the old one for this variant
                    variants[variantIndex].image = result.secure_url;
                }
            }
        });

        // Construct the final update object for MongoDB
        const updatedProductData = {
            name,
            category,
            description,
            images: existingImages, // The final list of main images (old + new)
            price: variants.length > 0 ? undefined : price,
            variants: variants.length > 0 ? variants : undefined
        };

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updatedProductData, { new: true });

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }

        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error while updating product.' });
    }
});


// DELETE a product by ID (No changes needed here)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// *** REMOVED: The old '/api/upload' route is no longer needed. ***


// 7. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
