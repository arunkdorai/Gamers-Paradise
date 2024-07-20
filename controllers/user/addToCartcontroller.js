const User = require("../../models/userModel");
const Product = require("../../models/productModel");
const Address = require("../../models/addressModel");
const mongoose = require("mongoose");

// function for to add product to cart
const addToCart = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.userData._id;

    // Find the user by ID
    const user = await User.findById(userId);

    // Ensure that user.cart exists and is an array
    if (!user.cart || !Array.isArray(user.cart)) {
      user.cart = []; // Initialize user.cart if it's undefined or not an array
    }

    // Check if the product already exists in the cart
    if (user.cart.includes(productId)) {
      return res.redirect("/add-to-cart"); // Redirect to cart page if product already exists
    }

    // Add the product to the user's cart
    user.cart.push(productId);
    await user.save();

    // Redirect to cart page after successfully adding the product
    return res.redirect("/add-to-cart");
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// const addToCart = async (req, res) => {
//   try {
//     const productId = req.params.productId;
//     const userId = req.session.userData._id;

//     // Find the user by ID
//     const user = await User.findById(userId);

//     // Ensure that user.cart exists and is an array
//     if (!user.cart || !Array.isArray(user.cart)) {
//       user.cart = []; // Initialize user.cart if it's undefined or not an array
//     }

//     // Check if the product already exists in the cart
//     const existingProductIndex = user.cart.findIndex(item => item.product.toString() === productId);

//     if (existingProductIndex !== -1) {
//       // If product exists, increase quantity by 1
//       user.cart[existingProductIndex].quantity += 1;
//     } else {
//       // Add the product to the user's cart with quantity 1
//       user.cart.push({ product: productId, quantity: 1 });
//     }

//     await user.save();

//     // Redirect to cart page after successfully adding the product
//     return res.redirect("/add-to-cart");
//   } catch (error) {
//     console.error("Error adding product to cart:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

//function for remove product from cart
async function removeFromCart(req, res) {
  try {
      const userId = req.user._id; // Assuming you have the user ID from the request
      const productId = req.params.productId; // Assuming the product ID is passed as a URL parameter

      let user = await User.findById(userId);

      if (!user) {
          return res.status(404).send({ error: 'User not found' });
      }

      // Log the cart contents for debugging
      console.log('User cart before removal:', JSON.stringify(user.cart, null, 2));

      // Check if the product exists in the cart
      const productExistsInCart = user.cart.some((item) => item.toString() === productId);

      if (!productExistsInCart) {
          return res.status(404).send({ error: 'Product not found in cart' });
      }

      // Filter out the product to be removed
      user.cart = user.cart.filter((item) => item.toString() !== productId);

      try {
          await user.save();

          // Log the cart contents after removal
          console.log('User cart after removal:', JSON.stringify(user.cart, null, 2));

          res.status(200).send({ message: 'Product removed from cart successfully' });
      } catch (error) {
          if (error instanceof mongoose.Error.VersionError) {
              // Retry logic: Fetch the user again and retry saving
              user = await User.findById(userId);

              // Check if the product exists in the cart
              const productExistsInCart = user.cart.some((item) => item.toString() === productId);

              if (!productExistsInCart) {
                  return res.status(404).send({ error: 'Product not found in cart' });
              }

              // Filter out the product to be removed
              user.cart = user.cart.filter((item) => item.toString() !== productId);

              await user.save();

              // Log the cart contents after removal
              console.log('User cart after removal:', JSON.stringify(user.cart, null, 2));

              res.status(200).send({ message: 'Product removed from cart successfully' });
          } else {
              throw error;
          }
      }
  } catch (error) {
      console.error('Error removing product from cart:', error);
      res.status(500).send({ error: 'An error occurred while removing the product from the cart' });
  }
}

//function for render cart page
const renderCartPage = async (req, res) => {
  try {
    const userId = req.session.userData._id;
    const fullName = req.session.userData.fullname;

    // Find the user by ID and populate the cart items
    const user = await User.findById(userId).populate("cart");

    // Check if the user has any cart items
    if (!user.cart || user.cart.length === 0) {
      return res.render("addtocart", { fullName, products: [] }); // Render the template with an empty array
    }

    // Filter out products with status true
    const filteredProducts = user.cart.filter(
      (product) => product.status === true
    );

    // Update user's cart with only the products with status true
    user.cart = filteredProducts;
    await user.save();
    req.session.checkout = true;
    // Render the cart page with the updated cart items
    res.render("addtocart", { fullName, products: filteredProducts });
  } catch (error) {
    console.error("Error rendering cart page:", error);
    res.status(500).send("Internal Server Error");
  }
};

// const renderCartPage = async (req, res) => {
//   try {
//     const userId = req.session.userData._id;
//     const fullName = req.session.userData.fullname;

//     // Find the user by ID and populate the cart items
//     const user = await User.findById(userId).populate("cart.product");

//     // Check if the user has any cart items
//     if (!user.cart || user.cart.length === 0) {
//       return res.render("addtocart", { fullName, products: [] }); // Render the template with an empty array
//     }

//     // Filter out products with status true
//     const filteredProducts = user.cart.filter(
//       (item) => item.product.status === true
//     ).map(item => ({
//       ...item.product.toObject(),
//       quantity: item.quantity
//     }));

//     // Update user's cart with only the products with status true
//     user.cart = filteredProducts;
//     await user.save();
//     req.session.checkout = true;
//     // Render the cart page with the updated cart items
//     res.render("addtocart", { fullName, products: filteredProducts });
//   } catch (error) {
//     console.error("Error rendering cart page:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };

//function for order checkout
// const checkout = (req, res) => {
//   // Retrieve cart data and total price from the request body
//   const { cartData, totalPrice, shipping, tax } = req.body;

//   // Parse cart data from JSON string to JavaScript object
//   const products = JSON.parse(cartData);

//   // Store cart data and total price in session
//   req.session.cart = products;
//   req.session.totalPrice = totalPrice;
//   req.session.shipping = shipping;
//   req.session.tax = tax;

//   // Redirect to the checkout page or perform any other actions
//   res.redirect("/checkout");
// };

const checkout = (req, res) => {
  // Retrieve cart data and total price from the request body
  const { cartData, totalPrice, shipping, tax } = req.body;

  // Parse cart data from JSON string to JavaScript object
  const products = JSON.parse(cartData);

  // Store cart data and total price in session
  req.session.cartData = products;
  req.session.totalPrice = totalPrice;
  req.session.shipping = shipping;
  req.session.tax = tax;
  req.session.checkout = true;

  // Redirect to the checkout page
  res.redirect("/checkout");
};

// const updateCartQuantity = async (req, res) => {
//   try {
//     const { productId, quantity } = req.body;
//     const userId = req.session.userData._id;

//     const user = await User.findById(userId);
//     // const cartItemIndex = user.cart.findIndex(item => item.toString() === productId);
//     const cartItemIndex = user.cart.findIndex(item => item.product.toString() === productId);

//     if (cartItemIndex !== -1) {
//       // Update the quantity in the user's cart
//       user.cart[cartItemIndex].quantity = quantity;
//       await user.save();
//       res.json({ success: true });
//     } else {
//       res.json({ success: false, message: 'Product not found in cart' });
//     }
//   } catch (error) {
//     console.error('Error updating cart quantity:', error);
//     res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// };

//     if (cartItemIndex !== -1) {
//       // Update the quantity in the user's cart
//       user.cart[cartItemIndex] = { product: productId, quantity: quantity };
//       await user.save();
//       res.json({ success: true });
//     } else {
//       res.json({ success: false, message: 'Product not found in cart' });
//     }
//   } catch (error) {
//     console.error('Error updating cart quantity:', error);
//     res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// };

module.exports = {
  checkout,
  renderCartPage,
  addToCart,
  removeFromCart,
  // updateCartQuantity,
};
