const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");

//function to change order status
const changeOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.body; // Use customOrderId
    const newStatus = "completed"; // Admin can only set to completed

    const order = await Order.findOne({ customOrderId:orderId }); // Find by customOrderId
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the current order status is 'pending'
    if (order.status !== "pending") {
      return res.status(400).json({
        message:
          `Order status can only be changed from 'pending' to 'completed'`,
      });
    }
    // Set new status if the validation passes
    order.status = newStatus;

    order.products.forEach((product) => {
      if (product.status === "pending") {
        product.status = "completed";
      }
    });
    await order.save();

    res
      .status(200)
      .json({ message: "Order status updated successfully to completed" });
  } catch (err) {
    console.error("Error updating order status", { error: err, customOrderId });
    res.status(500).send("Internal Server Error");
  }
};

//function for cancel the order
const cancelOrder = async (req, res) => {
  const { customOrderId } = req.params; // Use customOrderId

  try {
    const order = await Order.findOne({ customOrderId }); // Find by customOrderId
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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

    if (req.session.userData) {
      const userId = req.session.userData._id;
      const fullName = req.session.userData.fullname;
      const orders = await Order.find({ user: userId })
        .populate("address")
        .populate("products.product")
        .sort({ createdAt: -1 });

      res.status(200).json({ message: "Order cancelled successfully" });
    } else {
      res.status(200).json({ message: "Order cancelled successfully, but user data is missing in session" });
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//function for rendering order list page in admin
const getOrdersWithPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get page number from query parameter, default to 1
    const pageSize = parseInt(req.query.pageSize) || 10; // Get page size from query parameter, default to 10

    // Calculate skip value for pagination
    const skip = (page - 1) * pageSize;

    // Fetch orders for the current page with pagination
    const order = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("user")
      // .populate({ path: "products.product", select: "name price" })
      .populate("products.product")
      .populate("address");

    // Count total number of orders for pagination
    const totalOrders = await Order.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / pageSize);

    res.render("adminOrder", {
      order,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
};

//function for cancel products in order in admin side
const cancelProductAsAdmin = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
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
      const user = await User.findById(order.user);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      {
        order.reducedPrice =
          parseFloat(order.reducedPrice) + parseFloat(reducedPrice);
        await order.save();
      }
    }
    res.json({ success: true, message: "Product cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

//function to calculate reduced price
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
module.exports = {
  cancelProductAsAdmin,
  cancelOrder,
  getOrdersWithPagination,
  changeOrderStatus,
};
