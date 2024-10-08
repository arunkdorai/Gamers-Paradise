const categoryModel = require("../../models/catergoryModel");
const productModel = require("../../models/productModel");
const sharp = require("sharp");
const fs = require('fs').promises;
const path = require("path");
const mongoose = require("mongoose");

//function for render product list page in admin side
const getProduct = async (req, res) => {
  try {
    let page = +req.query.page || 1; // Get page number from query parameters or default to 1
    const ITEMS_PER_PAGE = 8;

    let query = {};
    let searchQuery = '';

    if (req.query.search) {
      searchQuery = req.query.search.trim();
      // Check if the search query is a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(searchQuery)) {
        query = { _id: searchQuery };
      } else {
        query = { 
          $or: [
            { product: { $regex: searchQuery, $options: 'i' } },
            { category: { $regex: searchQuery, $options: 'i' } }
          ]
        };
      }
    }

    const totalProducts = await productModel.countDocuments(query); // Get total number of products
    let totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE); // Calculate total number of pages

    // Adjust totalPages to at least 1 to prevent calculation errors when there are no products
    totalPages = Math.max(totalPages, 1);

    // Ensure the page number is within the valid range
    if (page < 1) {
      page = 1;
    } else if (page > totalPages) {
      page = totalPages;
    }

    // Calculate skip only after adjusting page and totalPages
    const skipAmount = Math.max(0, (page - 1) * ITEMS_PER_PAGE);

    // Find products with pagination
    const products = await productModel
      .find(query)
      .skip(skipAmount)
      .limit(ITEMS_PER_PAGE);

    // Calculate previous and next page numbers
    let prev = page > 1 ? page - 1 : null;
    let next = page < totalPages ? page + 1 : null;

    // Retrieve categories and message, if any
    let msg = req.query.msg || "";
    const category = await categoryModel.find({});

    // Render the adminProduct page with all the necessary data
    res.render("adminProduct", {
      data: products,
      prev: prev,
      next: next,
      totalPages: totalPages,
      currentPage: page,
      CatData: category,
      msg: msg,
      searchQuery: searchQuery
    });
  } catch (error) {
    console.log("Error in getProduct:", error);
    res.redirect("/admin/error");
  }
};

//function to render add product page
const productAddPage = async (req, res) => {
  try {
    let catergory = await categoryModel.find({});
    res.render("adminProduct-add", { data: catergory });
  } catch (e) {
    console.log("error in the productAddPage", e);
    res.redirect("/admin/error");
  }
};

//function for create new product
const addProduct = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files) {
      return res.status(400).send("No files were uploaded.");
    }

    const files = req.files;

    const uploadedImages = [];

    for (const file of files) {
      const resizedImageBuffer = await sharp(file.path)
        .resize({ width: 1200, height: 1200, fit: 'fill' })
        .toBuffer();

      const fileName = Date.now() + "-" + file.originalname;
      const filePath = path.join("./public/uploads/", fileName);
      fs.writeFile(filePath, resizedImageBuffer);
      let newPath = filePath.replace(/\\/g, "/").replace(/public/, "");
      uploadedImages.push({
        originalname: file.originalname,
        mimetype: file.mimetype,
        path: newPath,
      });
      // Remove original file after processing
      // Attempt to remove the original file
      // try {
      //   fs.unlinkSync(file.path);
      // } catch (unlinkErr) {
      //   console.error(`Failed to remove file: ${file.path}`, unlinkErr);
      // }
    }

    const {
      productName,
      category,
      description,
      about,
      price,
      stock,
      offerPrice,
    } = req.body;
    const newProduct = new productModel({
      product: productName,
      price: price,
      offerPrice: offerPrice || 0,
      description: description,
      category: category,
      stock: stock,
      image: uploadedImages,
      about: about,
    });

    await newProduct.save();
    res.redirect("/admin/Product");
  } catch (e) {
    console.log("error in the addProduct ", e);
    res.redirect("/admin/error");
  }
};

const editProduct = async (req, res) => {
  try {
    const proId = req.params.id;
    const product = await productModel.findById(proId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    const exImage = product.image || [];
    const exImagePaths = product.image.map((img) => img.path);
    const files = req.files || [];
    let updImages = [...exImage];
    const removedImagesPaths = req.body.removeImages ? req.body.removeImages.split(",").filter((path) => path) : [];

    if (files.length > 0) {
      // Process new uploaded images
    for (const file of files) {
      const resizedImageBuffer = await sharp(file.path)
        .resize(1200, 1200, { fit: 'fill' })
        .toBuffer();

      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join("./public/uploads/", fileName);
      await fs.writeFile(filePath, resizedImageBuffer);
      const newPath = filePath.replace(/\\/g, "/").replace(/public/, "");
      updImages.push({
        originalname: file.originalname,
        mimetype: file.mimetype,
        path: newPath,
      });

      await fs.unlink(file.path);
    }
    // Remove the paths of deleted images from the updImages array
  }

    updImages = updImages.filter((img) => !removedImagesPaths.includes(img.path));

    const { productName, price, description, about, category, stock, offerPrice } = req.body;
    const selectedCategory = await categoryModel.findOne({ name: category });

    const updatedProduct = await productModel.findByIdAndUpdate(
      proId,
      {
        product: productName,
        price: price,
        offerPrice: offerPrice || 0,
        description: description,
        category: selectedCategory ? selectedCategory._id : product.category,
        stock: stock,
        about: about,
        is_blocked: false,
        image: updImages,
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.redirect("/admin/error");
    }
      // Remove the images from the file system
    const uploadsDir = path.join(__dirname, "..", "..", "public");
    for (const imagePath of removedImagesPaths) {
      const fullPath = path.join(uploadsDir, imagePath);
      await fs.unlink(fullPath, (err) => {
        if (err) {
          console.error(`Failed to remove file: ${fullPath}`, err);
        }
      });
    }

    res.redirect("/admin/Product?msg=Product Edited successfully");
  } catch (e) {
    console.log("error in editProduct:", e);
    res.redirect("/admin/error");
  }
};

//function for change status of product
const changeStatus = async (req, res) => {
  try {
    const data = await productModel.findOne({ _id: req.query.id });
    if (data.status) {
      await productModel.updateOne({ _id: req.query.id }, { status: false });
    } else {
      await productModel.updateOne({ _id: req.query.id }, { status: true });
    }
    res.redirect("/admin/Product");
  } catch (e) {
    console.log("error in the changeStatus", e);
    res.redirect("/admin/error");
  }
};

//function to delete product
const deleteProduct = async (req, res) => {
  try {
    const data = await productModel.findByIdAndDelete(req.query.id);

    res.redirect("/admin/Product");
  } catch (e) {
    console.log("error in the changeStatus", e);
    res.redirect("/admin/error");
  }
};

module.exports = {
  getProduct,
  productAddPage,
  addProduct,
  editProduct,
  changeStatus,
  deleteProduct,
};
