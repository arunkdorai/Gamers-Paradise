const Address = require("../../models/addressModel");
const Product = require("../../models/productModel");
const Order = require("../../models/orderModel");
const User = require("../../models/userModel");

//function for rendering checkout page
const renderCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.userData._id;
    // Fetch addresses with status true from the database
    const user = await User.findById(userId)
      .populate({
        path: "addresses",
        // match: { status: true }, // Only populate addresses with status true
      })

    // Get tax, shipping, and total price from session data
    const cartData = req.session.cartData || [];
    const tax = req.session.tax; // Assuming tax is stored in session.cart
    const shipping = req.session.shipping; // Assuming shipping is stored in session.cart
    const totalPrice = req.session.totalPrice;

    // Parse the cartData from the session
    // const cartData = JSON.parse(req.session.cartData || '[]');

    let fullName = req.session.userData.fullname;
    let addresses = user.addresses;
    const errors = req.flash("error");

    // Clear the checkout flag
    // req.session.checkout = false;

    res.render("checkout", {
      addresses,
      tax: parseFloat(tax).toFixed(2),
      shipping,
      totalPrice,
      fullName,
      discountedAmount: 0,
      user,
      errors,
      cartData, // Pass the cart data to the view
    });
  } catch (error) {
    console.error("Error rendering checkout page:", error);
    res.status(500).send("Internal Server Error");
  }
};


module.exports = { renderCheckoutPage };
