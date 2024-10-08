const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Coupon = require("../../models/couponModel");
const razorpay = require("../../helpers/razorpay");
const Wallet = require("../../models/walletModel");
const Cart = require("../../models/addtocartModel");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const ITEMS_PER_PAGE = 5; // Number of orders per page

//function for rendering user order list
const renderOrderListPage = async (req, res) => {
  try {
    const userId = req.session.userData._id;
    const fullName = req.session.userData.fullname;
    delete req.session.order
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
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error rendering order list page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//function to cancel the order
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ customOrderId: req.params.customOrderId });

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

    if (
      order.paymentMethod !== "cash_on_delivery" &&
      order.paymentMethod !== "pay_by_wallet"
    ) {
      const user = await User.findById(req.session.userData._id).populate(
        "wallet"
      );

      if (!user || !user.wallet) {
        return res.status(404).json({ error: "User or wallet not found" });
      }

      user.wallet.balance = (
        parseFloat(user.wallet.balance) +
        parseFloat(order.totalPrice) +
        (order.walletAmount ? parseFloat(order.walletAmount) : 0) -
        parseFloat(order.reducedPrice)
      ).toFixed(2);

      // Add a new transaction to the wallet
      user.wallet.transactions.push({
        type: "credit",
        amount:
          parseFloat(order.totalPrice) +
          (order.walletAmount ? parseFloat(order.walletAmount) : 0) -
          parseFloat(order.reducedPrice),
        description: `Order ${order.customOrderId} cancelled`,
      });

      // Save the updated wallet
      await user.wallet.save();
    } else if (order.paymentMethod == "pay_by_wallet") {
      const user = await User.findById(req.session.userData._id).populate(
        "wallet"
      );

      if (!user || !user.wallet) {
        return res.status(404).json({ error: "User or wallet not found" });
      }

      user.wallet.balance =
        user.wallet.balance + order.walletAmount - parseFloat(order.reducedPrice);

      // Add a new transaction to the wallet
      user.wallet.transactions.push({
        type: "credit",
        amount: order.walletAmount - parseFloat(order.reducedPrice),
        description: `Order ${order.customOrderId} cancelled`,
      });

      // Save the updated wallet
      await user.wallet.save();
    }

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

    const user = await User.findById(userId).populate("addresses");
    const isFirstAddress = !user.addresses || user.addresses.length === 0;
    const newAddress = new Address({
      address,
      addressline2,
      city,
      state,
      pincode,
      status: isFirstAddress,
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
    const order = await Order.findOne({ customOrderId: req.params.customOrderId });
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
      const user = await User.findById(req.session.userData._id).populate(
        "wallet"
      );

      if (!user || !user.wallet) {
        return res.status(404).json({ error: "User or wallet not found" });
      }
      {
        order.reducedPrice =
          parseFloat(order.reducedPrice) + parseFloat(reducedPrice);
        await order.save();
      }
      user.wallet.balance = (
        parseFloat(user.wallet.balance) +
        parseFloat(reducedPrice) +
        (remainingProducts.length === 0 ? 45 : 0)
      ).toFixed(2);

      user.wallet.transactions.push({
        type: "credit",
        amount:
          parseFloat(reducedPrice) + (remainingProducts.length === 0 ? 45 : 0),
        description: `Order ${order.customOrderId} cancelled`,
      });

      await user.wallet.save();

    }

    res.redirect("/orders");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

//function for generate order return request
const returnOrderRequest = async (req, res) => {
  try {
    const order = await Order.findOne({customOrderId:req.params.customOrderId});
    const productId = req.params.productId;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = "returnrequest";

    await order.save();
    return res.status(200).redirect("/orders");
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

//function for generate product return request
const returnProductRequest = async (req, res) => {
  try {
    const order = await Order.findOne( {customOrderId:req.params.customOrderId} );
    const productId = req.params.productId;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const product = order.products.find(
      (p) => p.product.toString() === productId
    );

    if (!product || product.status !== "completed") {
      return res.status(400).json({ error: "Product cannot be returned" });
    }

    product.status = "returnrequest";

    const isLastCompleted =
      order.products.filter(
        (p) => p.status === "completed" && p.product.toString() !== productId
      ).length === 0;
    if (isLastCompleted) {
      order.status = "returnrequest";
    }
    await order.save();
    return res.status(200).redirect("/orders");
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
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
    const useWallet = req.body.useWallet;
    const couponCode = req.body.coupon;

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

    // Get the coupon code from the request body
    const products = req.session.cartData;
    const coupon = await Coupon.findOne({ code: couponCode });

    if (coupon && coupon.oncePerUser) {
      await User.findByIdAndUpdate(userId, {
        $push: { usedCoupons: coupon },
      });
    }

    for (const product of products) {
      const productObj = await Product.findById(product._id);
      if (!productObj || productObj.stock < product.quantity) {
        return res.status(400).redirect("/add-to-cart");
      }
    }


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
      walletAmount: difference.toFixed(2),
      discountedAmount,
      coupon: coupon ? coupon._id : null,
    });

    // let walletUpdate = null;
    // if (paymentMethod === "pay_by_wallet" || difference > 0) {
    //   const debitAmount = paymentMethod === "pay_by_wallet" ? totalPrice : difference.toFixed(2);
      
    //   walletUpdate = User.findOneAndUpdate(
    //     { _id: userId },
    //     {
    //       $inc: { "wallet.balance": -debitAmount },
    //       $push: {
    //         "wallet.transactions": {
    //           type: "debit",
    //           amount: debitAmount,
    //           description: `Order ${order.customOrderId} placed with wallet balance`
    //         }
    //       }
    //     },
    //     { new: true }
    //   );
    // }

    if (difference > 0) {
      const userWithWallet = await User.findById(userId).populate("wallet");
      const wallet = userWithWallet.wallet;
      
      await wallet.debitBalance(
        difference.toFixed(2),
        `Order ${order.customOrderId} placed with wallet balance`
      );
    }

    if (coupon && coupon.oncePerUser) {
      await User.findByIdAndUpdate(userId, {
        $push: { usedCoupons: coupon._id },
      });
    }

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
    return res.status(200).render("orderSuccess", { orderId: order.customOrderId });

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
    const processOrder = req.session.orderRazerpay;
    const totalPrice = parseFloat(processOrder.amount);
    const grandTotalPrice = parseFloat(req.session.totalPrice);
    const amount = req.session.amount;
    const discountedAmount = processOrder.discountedAmount
      ? parseFloat(processOrder.discountedAmount)
      : 0;

    if (isNaN(totalPrice) || isNaN(grandTotalPrice)) {
      throw new Error("Invalid totalPrice or grandTotalPrice");
    }

    // Create the order with the appropriate payment method
    const paymentMethod = "Online Payment";
    const user = await User.findById(req.session.userData._id).populate({
      path: "addresses",
      match: { status: true },
    });

    const coupon = await Coupon.findOne({ code: processOrder.coupon });
    const difference = grandTotalPrice - amount - discountedAmount; // Parse as float
    const activeAddress = user.addresses[0];
    const customOrderId = await Order.generateOrderId();
    const order = await Order.create({
      user: req.session.userData._id,
      grandTotalPrice: grandTotalPrice,
      totalPrice,
      paymentMethod,
      customOrderId,
      address: activeAddress._id,
      products: req.session.cartData.map((item) => ({
        product: item._id,
        quantity: item.quantity,
      })),
      walletAmount: difference.toFixed(2),
      discountedAmount, // Use the discountedAmount value after validation
      coupon: coupon ? coupon._id : null,
    });

    if (
      totalPrice != 0 &&
      totalPrice != grandTotalPrice &&
      discountedAmount == 0
    ) {
      const user = await User.findById(userId).populate("wallet");
      const wallet = user.wallet;

      await wallet.debitBalance(
        difference.toFixed(2),
        `Order ${order.customOrderId} placed along with wallet balance`
      );
    }

    if (coupon && coupon.oncePerUser) {
      await User.findByIdAndUpdate(userId, {
        $push: { usedCoupons: coupon._id },
      });
    }


    // Associate the order with the user
    await User.findByIdAndUpdate(userId, {
      $push: { order: order._id },
    });
    // 5. Update product quantities and clear the cart
    await Promise.all(
      req.session.cartData.map(async (item) => {
        const product = await Product.findById(item._id);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      })
    );

    req.session.cartData = [];
    await Cart.findOneAndUpdate({ userId: userId }, { cartItems: [] });
    req.session.order=order
    // 6. Redirect to the order success page or perform any other necessary actions
    // return res.status(200).render("orderSuccess", { orderId: order.customOrderId });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
const orderSuccess= (req, res) => {
  try{
    res.render('orderSuccess',{orderId:req.session.order.customOrderId});
  }catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }

}
//function for create order for razor pay
const createorder = async (req, res) => {
  try {
    const { amount, orderRazerpay } = req.body;
    req.session.orderRazerpay = orderRazerpay;
    req.session.amount = amount;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "arunkumar.k666@gmail.com",
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};


//function for create invoice as pdf for invoice download
const invoice = async (req, res) => {
  try {
    const orderId = req.params.customOrderId;
    const order = await Order.findOne({customOrderId: orderId})
      .populate("products.product")
      .populate("address")
      .populate("coupon");
    const user = await User.findOne({ _id: order.user._id });

    if (
      !order ||
      (order.status !== "completed" && order.status !== "returned")
    ) {
      return res
        .status(404)
        .json({ error: "Order not found or not in a valid status" });
    }

    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
    const fileName = `invoice_${orderId}.pdf`;
    const filePath = path.join(__dirname, "invoices", fileName);

    // Create WriteStream to save the PDF file
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    doc.pipe(res);

    // Set up logo and company name
    doc.image("public/images/logo.png", 50, 50, { width: 50 });
    doc.moveDown(3); // Add space after the logo
    doc
      .fillColor("#552FA8")
      .fontSize(18)
      .text("Gamers Paradise", 400, 65, { align: "right" });
    doc.moveDown(0.5); // Add space before the customer name
    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(`Ordered Date: ${order.createdAt.toDateString()}`, 300, 130, {
        align: "right",
      });

    doc.moveDown(2);

    // Add user and address details
    doc
      .fillColor("#333333")
      .fontSize(14)
      .text(`Customer: ${user.fullname}`, 50, 130); // Adjust vertical position
    doc.fillColor("#333333").fontSize(12).text(
      `Address: ${order.address.address}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
      50,
      150 // Adjust vertical position
    );
    doc.moveDown(1);

    // Draw a box around order details with a heading
    const boxTop = 200; // Adjust vertical position
    const boxHeight = 250;
    doc
      .fillColor("#333333")
      .fontSize(16)
      .text(`Invoice for Order #${order.customOrderId}`, { align: "center" });
      
    doc.rect(50, boxTop, 500, boxHeight).stroke("#552FA8").moveDown(1);;

    // Add order details table inside the box
    const completedAndReturnedProducts = order.products.filter(
      (item) => item.status === "completed"
    );
    const table = {
      headers: ["Product", "Quantity", "Price"],
      rows: completedAndReturnedProducts.map((item) => [
        item.product.product,
        item.quantity,
        `Rs.${item.product.price}`,
      ]),
    };
    generateTable(
      doc,
      table,
      boxTop + 30,
      [200, 100, 100],
      [100, 350, 450],
      "#552FA8",
      { align: "left" }
    );

    // Add payment method
    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(
        `Payment Method: ${order.paymentMethod}`,
        50,
        boxTop + boxHeight + 20
      );

    let total = completedAndReturnedProducts.reduce(
      (acc, item) => acc + item.product.price * item.quantity,
      0
    );
    const tax = total * 0.05; // 5% tax

    // Add order totals
    doc
      .fillColor("#552FA8")
      .fontSize(14)
      .text("Order Totals:", 350, boxTop + boxHeight + 20);
    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(`Tax: Rs.${tax.toFixed(2)}`, 350, boxTop + boxHeight + 40);
    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(`Shipping: Rs.${45}`, 350, boxTop + boxHeight + 60);

    // Add coupon details if applied
    if (order.coupon) {
      doc
        .fillColor("#333333")
        .fontSize(12)
        .text(
          `Coupon Code: ${order.coupon.code}`,
          350,
          boxTop + boxHeight + 80
        );
      const totalTax = (order.grandTotalPrice - 45) / 21;
      const totalAfterTaxAndShipping = order.grandTotalPrice - 45 - totalTax;
      var discount =
        (order.discountedAmount / totalAfterTaxAndShipping) * total;
      total = total - discount;
      doc
        .fillColor("#333333")
        .fontSize(12)
        .text(
          `Discount: Rs.${discount.toFixed(2)}`,
          350,
          boxTop + boxHeight + 100
        );
    }

    // Display wallet balance used
    if (order.paymentMethod === "pay_by_wallet") {
      doc
        .fillColor("#333333")
        .fontSize(12)
        .text(
          `Wallet Balance Used: Rs.${order.walletAmount-order.discountedAmount-order.returnedPrice.toFixed(2)}`,
          350,
          boxTop + boxHeight + 120
        );
    }else if(order.walletAmount>0){
      doc
      .fillColor("#333333")
      .fontSize(12)
      .text(
        `Wallet Balance Used: Rs.${order.walletAmount.toFixed(2)}`,
        350,
        boxTop + boxHeight + 120
      );
    }

    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(
        `Total Price: Rs.${(total + tax + 45).toFixed(2)}`,
        350,
        boxTop + boxHeight + 140
      );

    doc
      .fillColor("#333333")
      .fontSize(12)
      .text(
        `This is a computer generated invoice`,
        50,
        boxTop + boxHeight + 200
      );

    // Add a horizontal line to separate the totals
    doc
      .moveTo(50, boxTop + boxHeight + 180)
      .lineTo(550, boxTop + boxHeight + 180)
      .stroke("#552FA8");

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// Function to generate a table in PDFKit
function generateTable(
  doc,
  table,
  startY,
  columnWidths,
  columnPositions,
  color,
  options = {}
) {
  const initialPosition = 70; // Adjust based on your layout
  const rowHeight = 20;
  const padding = 5; // Adjust padding as needed

  doc.font("Helvetica-Bold");
  table.headers.forEach((header, i) => {
    doc
      .fillColor(color)
      .text(header, columnPositions[i] + padding, startY, options);
  });

  doc.font("Helvetica");
  let yPos = startY + rowHeight;
  table.rows.forEach((row) => {
    row.forEach((cell, i) => {
      doc
        .fillColor(color)
        .text(cell, columnPositions[i] + padding, yPos, options);
    });
    yPos += rowHeight;
  });
}

//function for handle payment fail in razor pay
const paymentFail = async (req, res) => {
  try {
    req.session.checkout = false;
    const discountedTotalPrice = req.session.discountedTotalPrice;
    let userId = req.session.userData._id;
    const razorpayOrder = req.session.orderRazerpay;
    const processOrder = req.session.orderRazerpay;
    const totalPrice = parseFloat(razorpayOrder.amount);
    const grandTotalPrice = parseFloat(req.session.totalPrice);
    const amount = req.session.amount;
    const discountedAmount = processOrder.discountedAmount
      ? parseFloat(processOrder.discountedAmount)
      : 0;

    if (isNaN(totalPrice) || isNaN(grandTotalPrice)) {
      throw new Error("Invalid totalPrice or grandTotalPrice");
    }

    // 4. Create the order with the appropriate payment method
    const paymentMethod = "Online Payment";
    const user = await User.findById(req.session.userData._id).populate({
      path: "addresses",
      match: { status: true },
    });
    const coupon = await Coupon.findOne({ code: processOrder.coupon });
    const difference = grandTotalPrice - amount - discountedAmount; // Parse as float
    const activeAddress = user.addresses[0];
    const customOrderId = await Order.generateOrderId();

    const order = await Order.create({
      user: req.session.userData._id,
      totalPrice,
      grandTotalPrice: grandTotalPrice,
      paymentMethod,
      customOrderId,
      address: activeAddress._id,
      products: req.session.cartData.map((item) => ({
        product: item._id,
        quantity: item.quantity,
        status: "paymentpending",
      })),
      walletAmount: difference.toFixed(2),
      discountedAmount, // Use the discountedAmount value after validation
      coupon: coupon ? coupon._id : null,
      status: "paymentpending",
    });

    req.session.customOrderId = customOrderId;

    if (
      totalPrice != 0 &&
      totalPrice != grandTotalPrice &&
      discountedAmount == 0
    ) {
      const user = await User.findById(userId).populate("wallet");
      const wallet = user.wallet;
      user.wallet.balance = user.wallet.balance - difference.toFixed(2);
      user.wallet.save();
      await wallet.debitBalance(
        difference.toFixed(2),
        `Order ${order.customOrderId} placed along with wallet balance`
      );
    }

    if (coupon && coupon.oncePerUser) {
      await User.findByIdAndUpdate(userId, {
        $push: { usedCoupons: coupon._id },
      });
    }

    // Associate the order with the user
    await User.findByIdAndUpdate(userId, {
      $push: { order: order._id },
    });
    // 5. Update product quantities and clear the cart
    await Promise.all(
      req.session.cartData.map(async (item) => {
        const product = await Product.findById(item._id);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      })
    );

    req.session.cartData = [];
    await User.findByIdAndUpdate(userId, { cart: [] });

    // 6. Redirect to the order success page or perform any other necessary actions
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

//function for handle repayment using razorpay
const repayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const customOrderId = req.session.customOrderId; // Retrieve from session
    req.session.amount = amount;
    const userId = req.session.userData._id;
    const receipt = `repayment_order_${customOrderId}`;

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res
        .status(500)
        .json({ success: false, message: "Error creating Razorpay order" });
    }

    res.status(200).json({
      success: true,
      orderId: order.customOrderId,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

//function for create order for razor pay of failed payments order
const repaymentOrderCreation = async (req, res) => {
  try {
    let userId = req.session.userData._id;
    let customOrderId = req.session.customOrderId;
    

    if (!customOrderId) {
      // Retrieve the most recent order with payment pending status
      const recentOrder = await Order.findOne({ user: userId, status: "paymentpending" }).sort({ createdAt: -1 });
      if (!recentOrder) {
        return res.status(404).json({ error: "No pending order found" });
      }
      customOrderId = recentOrder.customOrderId;
    }

    const order = await Order.findOne({ customOrderId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = "pending";
    order.products.forEach((product) => {
      if (product.status === "paymentpending") {
        product.status = "pending";
      }
    });

    await order.save();

    // Clear the cart after successful payment
    req.session.cartData = [];
    await Cart.findOneAndUpdate({ userId: userId }, { cartItems: [] });
    req.session.order=order

    res.status(201).redirect("/orders");
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

//function for abort the order which is in payment pending status
const orderAbort = async (req, res) => {
  try {
    const orderId = req.params.customOrderId;
    const order = await Order.findOne({ customOrderId: orderId }); // Corrected

    // Check if the order is found
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if the order is already cancelled or completed
    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Order is already cancelled" });
    }

    if (order.status === "completed") {
      return res.status(400).redirect("/orders");
    }

    // Update order status to "cancelled"
    order.status = "cancelled";
    order.products.forEach((product) => {
      if (product.status === "paymentpending") {
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

    if (order.paymentMethod !== "cash_on_delivery" && order.paymentMethod !== "pay_by_wallet") {
      const user = await User.findById(req.session.userData._id).populate("wallet");

      if (!user || !user.wallet) {
        return res.status(404).json({ error: "User or wallet not found" });
      }

      user.wallet.balance = (
        parseFloat(user.wallet.balance) +
        (order.walletAmount ? parseFloat(order.walletAmount) : 0)
      ).toFixed(2);

      if (order.walletAmount != 0) {
        // Add a new transaction to the wallet
        user.wallet.transactions.push({
          type: "credit",
          amount:
            (order.walletAmount ? parseFloat(order.walletAmount) : 0) -
            parseFloat(order.reducedPrice),
          description: `Order ${order.customOrderId} cancelled`,
        });
      }
      // Save the updated wallet
      await user.wallet.save();
    }

    const userId = req.session.userData._id;
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

module.exports = {
  orderAbort,
  renderOrderListPage,
  returnProductRequest,
  returnOrderRequest,
  createorder,
  placeOrder,
  cancelProduct,
  addAddressorder,
  orderviewaddresses,
  renderOrderListPage,
  cancelOrder,
  processpayment,
  invoice,
  paymentFail,
  repayment,
  repaymentOrderCreation,
  orderSuccess,
};
