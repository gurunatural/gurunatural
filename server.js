// server.js

// 1. Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// 2. Initialize Express App
const app = express();

// 3. Middleware
app.use(cors()); // Allows your frontend to communicate with this backend
app.use(express.json({ limit: '50mb' })); // Parses incoming JSON requests and increases payload limit for images

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('Connection error:', err));

// 5. Mongoose Schemas and Models
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    position: { type: Number, default: 0 }
});

const Category = mongoose.model('Category', categorySchema);

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
    images: [String]
  }]
});

const Product = mongoose.model('Product', productSchema);

// --- HELPER FUNCTION ---
async function findOrCreateCategory(categoryName) {
    let category = await Category.findOne({ name: categoryName });
    if (!category) {
        const highestPositionCategory = await Category.findOne().sort('-position');
        const newPosition = highestPositionCategory ? highestPositionCategory.position + 1 : 0;
        category = new Category({ name: categoryName, position: newPosition });
        await category.save();
    }
    return category;
}


// --- API ROUTES ---

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products: ' + error.message });
  }
});

// GET all categories, sorted by position
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort('position');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch categories: ' + error.message });
    }
});

// POST a new product
app.post('/api/products', async (req, res) => {
  try {
    await findOrCreateCategory(req.body.category);
    const product = new Product(req.body);
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(400).json({ message: 'Failed to add product: ' + error.message });
  }
});

// UPDATE a product by ID
app.put('/api/products/:id', async (req, res) => {
    try {
        await findOrCreateCategory(req.body.category);
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update product: ' + error.message });
    }
});

// UPDATE the order of categories
app.put('/api/categories/order', async (req, res) => {
    const { orderedCategories } = req.body;
    try {
        const promises = orderedCategories.map((categoryName, index) => {
            return Category.updateOne({ name: categoryName }, { $set: { position: index } });
        });
        await Promise.all(promises);
        res.json({ message: 'Category order updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update category order: ' + error.message });
    }
});

// NEW: UPDATE a category name
app.put('/api/categories/:name', async (req, res) => {
    const oldName = decodeURIComponent(req.params.name);
    const { newName } = req.body;
    
    if (!newName) {
        return res.status(400).json({ message: 'New category name is required.' });
    }

    try {
        // Check if the new name already exists
        const existingCategory = await Category.findOne({ name: newName });
        if (existingCategory) {
            return res.status(409).json({ message: `Category '${newName}' already exists.` });
        }

        // Update all products with the new category name
        await Product.updateMany({ category: oldName }, { $set: { category: newName } });
        
        // Update the category name in the categories collection
        await Category.updateOne({ name: oldName }, { $set: { name: newName } });

        res.json({ message: `Category '${oldName}' was successfully renamed to '${newName}'.` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to rename category: ' + error.message });
    }
});


// DELETE a product by ID
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const remainingProducts = await Product.countDocuments({ category: product.category });
    if (remainingProducts === 0) {
        await Category.deleteOne({ name: product.category });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product: ' + error.message });
  }
});

// DELETE a category and all its products
app.delete('/api/categories/:name', async (req, res) => {
    const categoryName = decodeURIComponent(req.params.name);
    try {
        const category = await Category.findOne({ name: categoryName });
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        
        await Product.deleteMany({ category: categoryName });
        await Category.deleteOne({ name: categoryName });

        res.json({ message: `Category '${categoryName}' and all its products have been deleted.` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete category: ' + error.message });
    }
});


// 6. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

