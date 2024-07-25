const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/addtocartModel")
const fs = require("fs");
const path = require("path");
const ITEMS_PER_PAGE = 5; // Number of orders per page

//function for rendering user order list
const renderOrderListPage = async (req, res) => {
  try {
    const userId = req.session.userData._id;
    const fullName = req.session.userData.fullname;
    let page = +req.query.page || 1; // Get page number from query parameters or default to 1
    const ITEMS_PER_PAGE = 9; // Define the number of items per page

    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

    // Ensure page number is within valid range
    page = Math.max(1, Math.min(page, totalPages));

    const skipValue = (page - 1) * ITEMS_PER_PAGE; // Calculate skip value

    const orders = await Order.find({ user: userId })
      .populate("address")
      .populate("products.product")
      .sort({ createdAt: -1 })
      .skip(skipValue)
      .limit(ITEMS_PER_PAGE);

    res.render("userOrderList", {
      orders,
      fullName,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error rendering order list page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//function for cancel the order
const cancelOrder = async (req, res) => {
  try {
    const customOrderId = req.params.customOrderId;
    const order = await Order.findOne({ customOrderId: customOrderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if the order is already cancelled
    if (order.status === "Cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already cancelled" });
    }

    // Check if the order is completed
    if (order.status === "completed") {
      return res.status(400).redirect("/orders");
    }

    // Update order status to "Cancelled"
    order.status = "cancelled";

    order.products.forEach((product) => {
      if (product.status === "pending") {
        product.status = "cancelled";
      }
    });

    await order.save();

    // Restore product quantities
    await Promise.all(
      order.products.map(async (orderItem) => {
        const product = await Product.findById(orderItem.product);
        if (product) {
          product.stock += orderItem.quantity;
          await product.save();
        }
      })
    );

    const userId = req.session.userData._id;
    const fullName = req.session.userData.fullname;
    const orders = await Order.find({ user: userId })
      .populate("address")
      .populate("products.product")
      .sort({ createdAt: -1 });
    res.status(200).redirect("/orders");
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//function for view address list in checkout page
const orderviewaddresses = async (req, res) => {
  try {
    const userId = req.session.userData ? req.session.userData._id : null;
    if (!userId) {
      return res.status(403).redirect("/login");
    }
    const user = await User.findById(userId).populate("addresses");

    // Extract addresses from the user object
    const addresses = user.addresses;
    let fullName = user.fullname;
    res.render("orderviewaddress", { fullName, addresses });
  } catch (error) {
    console.error("Error rendering  page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//function for add address in checkout page
const addAddressorder = async (req, res) => {
  try {
    const { address, addressline2, city, state, pincode } = req.body;
    const userId = req.session.userData ? req.session.userData._id : null;

    if (!userId) {
      return res.status(403).redirect("/login");
    }

    const newAddress = new Address({
      address,
      addressline2,
      city,
      state,
      pincode,
    });

    await newAddress.save();

    // Add the new address to the user's addresses array
    await User.findByIdAndUpdate(userId, {
      $push: { addresses: newAddress._id },
    });

    res.redirect("/orderviewaddresses");
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: "Failed to add address" });
  }
};
//function for cancel the product in an order
const cancelProduct = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    const productId = req.params.productId;
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Cannot cancel product for this order" });
    }

    const productIndex = order.products.findIndex(
      (p) => p.product.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).json({ error: "Product not found in the order" });
    }

    const product = order.products[productIndex];
    const productObj = await Product.findById(product.product);
    const productPrice = parseFloat(productObj.price) || 0;
    const productQuantity = product.quantity;

    if (isNaN(productPrice) || isNaN(productQuantity)) {
      return res
        .status(400)
        .json({ error: "Invalid product price or quantity" });
    }

    const discountedAmount = parseFloat(order.discountedAmount) || 0;
    const totalPrice = parseFloat(order.grandTotalPrice)
      ? parseFloat(order.grandTotalPrice)
      : 0;
    const reducedPrice = calculateReducedPrice(
      productPrice * productQuantity,
      discountedAmount,
      totalPrice
    );

    const isLastCompleted =
      order.products.filter(
        (p) => p.status === "completed" && p.product.toString() !== productId
      ).length === 0;
    product.status = "cancelled";

    const updatedOrder = await order.save();

    productObj.stock += productQuantity;
    await productObj.save();

    const remainingProducts = order.products.filter(
      (p) => p.status !== "cancelled"
    );

    if (remainingProducts.length === 0) {
      order.status = "cancelled";

      await order.save();
    }
    if (order.paymentMethod !== "cash_on_delivery") {
      const user = await User.findById(req.session.userData._id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      {
        order.reducedPrice =
          parseFloat(order.reducedPrice) + parseFloat(reducedPrice);
        await order.save();
      }

    }

    res.redirect("/orders");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


//function for calculate reduced amount
function calculateReducedPrice(price, discountedAmount, totalPrice) {
  // Convert input values to numbers
  const numericPrice = parseFloat(price);
  const numericDiscountedAmount = parseFloat(discountedAmount);
  const taxtotal = (parseFloat(totalPrice) - 45) / 21;
  const numericTotalPrice = parseFloat(totalPrice) - (45 + taxtotal);

  const discountPercentage =
    (numericDiscountedAmount / numericTotalPrice) * 100;
  const discountedPrice = numericPrice * (discountPercentage / 100);
  const tax = numericPrice * 0.05; // 5% tax
  const deductedAmount = numericPrice - discountedPrice;
  let reducedPrice = deductedAmount + tax;

  // Round reducedPrice to two decimal points
  reducedPrice = reducedPrice.toFixed(2);

  return reducedPrice;
}

//function for placing new order
const placeOrder = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.redirect("/login");
    }

    req.session.checkout = false;
    const cart = req.session.cartData; // Use cartData instead of cart
    const userId = req.session.userData._id;
    const totalPrice = req.body.totalPrice;
    const discountedAmount = req.body.discountedAmount;
    const paymentMethod = req.body.paymentMethod;

    // Debugging statement to check session data
    // console.log("Session Data:", req.session);

    if (!Array.isArray(cart) || cart.length === 0) {
      console.log("Cart is empty or invalid:", cart);
      return res.status(400).redirect("/add-to-cart");
    }

    // Fetch the user's active address
    const user = await User.findById(userId).populate({
      path: "addresses",
      match: { status: true },
    });

    if (user.addresses.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No active address found" });
    }

    const activeAddress = user.addresses[0];
    // Check product availability and stock
    for (const item of cart) {
      if (!item._id) {
        console.log("Invalid item in cart:", item);
        return res.status(400).redirect("/add-to-cart");
      }

      const productObj = await Product.findById(item._id);
      if (!productObj) {
        console.log("Product not found:", item._id);
        return res.status(400).redirect("/add-to-cart");
      }

      if (productObj.stock < item.quantity) {
        console.log("Insufficient stock for product:", productObj._id);
        return res.status(400).redirect("/add-to-cart");
      }
    }

    const customOrderId = await Order.generateOrderId();
    const grandTotalPrice = req.session.totalPrice;
    const difference = grandTotalPrice - totalPrice - parseInt(discountedAmount);

    const order = await Order.create({
      grandTotalPrice: grandTotalPrice,
      user: userId,
      customOrderId,
      totalPrice: req.body.totalPrice,
      paymentMethod,
      address: activeAddress._id,
      products: cart.map((item) => ({
        product: item._id,
        quantity: item.quantity,
      })),
    });

    // Associate the order with the user
    await User.findByIdAndUpdate(userId, {
      $push: { order: order._id },
    });

    // Update product quantities
    await Promise.all(
      cart.map(async (item) => {
        const product = await Product.findById(item._id);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      })
    );

    // Clear cart after placing order
    req.session.cartData = []; // Clear cartData instead of cart
    req.session.totalPrice = 0;

    // Clear cart in the database
    await Cart.findOneAndUpdate({ userId: userId }, { cartItems: [] });

    // Render the success page with the order ID
    return res.status(200).render("orderSuccess", { orderId: customOrderId });

  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ success: false, message: "Error placing order" });
  }
};

//function for placing new order using online payment
const processpayment = async (req, res) => {
  try {
    req.session.checkout = false;
    const discountedTotalPrice = req.session.discountedTotalPrice;
    let userId = req.session.userData._id;
    const processOrder = req.session;
    const totalPrice = parseFloat(processOrder.amount);
    const grandtotalPrice = parseFloat(req.session.totalPrice);
    const amount = req.session.amount;
    const discountedAmount = processOrder.discountedAmount
      ? parseFloat(processOrder.discountedAmount)
      : 0;

    if (isNaN(totalPrice) || isNaN(grandtotalPrice)) {
      throw new Error("Invalid totalPrice or grandtotalPrice");
    }

    // 4. Create the order with the appropriate payment method
    const paymentMethod = "Cash on Delivery";
    const user = await User.findById(req.session.userData._id).populate({
      path: "addresses",
      match: { status: true },
    });
    const difference = grandtotalPrice - amount - discountedAmount; // Parse as float
    const activeAddress = user.addresses[0];
    const order = await Order.create({
      user: req.session.userData._id,
      grandTotalPrice: grandtotalPrice,
      totalPrice,
      paymentMethod,
      address: activeAddress._id,
      products: req.session.cart.map((item) => ({
        product: item._id,
        quantity: item.quantity,
      })),
    });

    // Associate the order with the user
    await User.findByIdAndUpdate(userId, {
      $push: { order: order.customOrderId },
    });
    // 5. Update product quantities and clear the cart
    await Promise.all(
      req.session.cart.map(async (item) => {
        const product = await Product.findById(item._id);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      })
    );

    req.session.cart = [];
    await Cart.findOneAndUpdate({ userId: userId }, { cartItems: [] });

    // 6. Redirect to the order success page or perform any other necessary actions
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

module.exports = {
  renderOrderListPage,
  placeOrder,
  cancelProduct,
  addAddressorder,
  orderviewaddresses,
  renderOrderListPage,
  cancelOrder,
  processpayment,
};
