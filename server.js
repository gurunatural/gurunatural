// server.js

// 1. Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

// 2. Initialize Express App
const app = express();

// 3. Middleware
app.use(cors());
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

// 6. Mongoose Schema and Model
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
// *** MULTER & CLOUDINARY SETUP FOR FILE UPLOADS ***
// =================================================================================

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "guru_sampoorna_products" },
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

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// =================================================================================
// *** ADDED: The missing route to get all unique categories ***
// This is the critical piece that was missing from your file.
// =================================================================================
app.get('/api/categories', async (req, res) => {
  try {
    // Find all unique category strings in the Product collection
    const categories = await Product.distinct('category');
    // The frontend expects an array of objects with a 'name' key
    const categoryObjects = categories.map(name => ({ name }));
    res.json(categoryObjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// =================================================================================


// POST a new product
app.post('/api/products', upload.any(), async (req, res) => {
    try {
        const { name, category, description, price } = req.body;
        let variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        const files = req.files;
        let mainImageUrls = [];
        
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);

        uploadResults.forEach((result, index) => {
            const originalField = files[index].fieldname;
            if (originalField === 'images') {
                mainImageUrls.push(result.secure_url);
            } else if (originalField.startsWith('variant_image_')) {
                const variantIndex = parseInt(originalField.split('_')[2]);
                if (variants[variantIndex]) {
                    variants[variantIndex].image = result.secure_url;
                }
            }
        });

        const newProduct = new Product({
            name,
            category,
            description,
            images: mainImageUrls,
            price: variants.length > 0 ? undefined : price,
            variants: variants.length > 0 ? variants : undefined,
        });

        await newProduct.save();
        res.status(201).json(newProduct);

    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error while creating product.' });
    }
});


// UPDATE a product by ID
app.put('/api/products/:id', upload.any(), async (req, res) => {
    try {
        const { name, category, description, price } = req.body;
        let variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        let existingImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];
        const files = req.files;
        
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);

        uploadResults.forEach((result, index) => {
            const originalField = files[index].fieldname;
            if (originalField === 'images') {
                existingImages.push(result.secure_url);
            } else if (originalField.startsWith('variant_image_')) {
                const variantIndex = parseInt(originalField.split('_')[2]);
                if (variants[variantIndex]) {
                    variants[variantIndex].image = result.secure_url;
                }
            }
        });

        const updatedProductData = {
            name, category, description,
            images: existingImages,
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


// DELETE a product by ID
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
;
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// 7. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

