// --- IMPORTS ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Loads environment variables from a .env file into process.env

// --- INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
// Enable Cross-Origin Resource Sharing (CORS) to allow frontend to communicate with this backend
app.use(cors()); 
// Parse incoming JSON requests. The limit is increased to handle base64 image data.
app.use(express.json({ limit: '10mb' }));

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('Connection error:', err));

// --- MONGOOSE SCHEMA & MODEL ---
// This schema is designed to be flexible, supporting both simple products and products with multiple variants/images, just like your frontend.
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: String,
    // For simple products
    price: Number,
    img: String, // Can store a URL or a base64 string
    // For products with variants
    images: [String], // Array of URLs or base64 strings
    variants: [{
        size: String,
        price: Number
    }]
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);


// --- API ROUTES ---

/**
 * @route   POST /api/products
 * @desc    Add a new product to the database
 */
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct); // 201 Created status
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(400).json({ message: "Failed to add product", error: error.message }); // 400 Bad Request
    }
});

/**
 * @route   GET /api/products
 * @desc    Fetch all products from the database
 */
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products); // 200 OK status
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Failed to fetch products", error: error.message }); // 500 Internal Server Error
    }
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

