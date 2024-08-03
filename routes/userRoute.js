const express = require("express"); // Import the Express.js framework
const router = express.Router(); // Create a new router instance
const passport = require("passport"); // Import the Passport.js authentication middleware
const User = require("../models/userModel"); // Import the User model
const {
  checkoutMiddleware,
  isAuth,
  isAuthSIGNUP,
  isAuthcommon,
} = require("../middleware/authMiddleware"); // Import authentication middleware functions
const nocacheMiddleware = require("../middleware/noCache"); // Import middleware to prevent caching
const authController = require("../controllers/user/authController"); // Import the authentication controller
const profileController = require("../controllers/user/profileController"); // Import the profile controller
const otpController = require("../controllers/user/otpController"); // Import the OTP controller
const userProductController = require("../controllers/user/userProductController"); // Import the product controller
const wishlistController = require("../controllers/user/wishListController"); // Import the wishlist controller
const addToCartController = require("../controllers/user/addToCartcontroller"); // Import the cart controller
const checkoutController = require("../controllers/user/checkoutController"); // Import the checkout controller
const orderController = require("../controllers/user/orderController"); // Import the order controller
const walletController = require("../controllers/user/walletController"); // Import the wallet controller
const { checkUserStatus } = require("../middleware/blockedStatus"); // Import middleware to check user's blocked status

// Routes for adding and editing user addresses
router.get(
  "/add-address",
  isAuth,
  checkUserStatus,
  profileController.renderAddAddressPage
);
router.post(
  "/add-address",
  isAuth,
  checkUserStatus,
  profileController.addAddress
);
router.get("/logout", profileController.logout);

// Google authentication routes
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login", // Redirect on failed login
    failureFlash: true, // Enable flash messages
  }),
  (req, res) => {
    req.session.isAuth = true;
    // Successful authentication, redirect home.
    req.session.userData = req.user; // `req.user` contains the authenticated user.
    res.redirect("/");
  }
);
// Route to render the home page
router.get("/", nocacheMiddleware(), profileController.homePage);

// Routes for signup and login
router.get("/signup", nocacheMiddleware(), isAuthSIGNUP, (req, res) => {
  res.redirect("/");
});
router.get("/login", nocacheMiddleware(), isAuth, (req, res) => {
  res.redirect("/");
});
router.post("/login", isAuthcommon, nocacheMiddleware(), authController.login);
router.post(
  "/signup",
  isAuthcommon,
  nocacheMiddleware(),
  authController.signup
);

// Routes for OTP verification and resend
router.post(
  "/verifyOTP",
  isAuthcommon,
  nocacheMiddleware(),
  otpController.verifyOTP
);
router.post(
  "/resendOTP",
  isAuthcommon,
  nocacheMiddleware(),
  otpController.resendOTP
);
router.get("/otp", isAuthcommon, nocacheMiddleware(), otpController.otppage);

// Routes for products and categories
router.get("/product/:productId", userProductController.getProductView);
router.get("/console", userProductController.getConsoleProducts);
router.get("/consolefilter", userProductController.consolefilterProduct);
router.get("/games", userProductController.getgamesProducts);
router.get("/gamesfilter", userProductController.gamesfilterProduct);
router.get("/computer", userProductController.getcomputerProducts);
router.get("/computerfilter", userProductController.computerfilterProduct);
// router.get("/shop", userProductController.getshopProducts);
router.get("/shop", userProductController.shopfilterProduct);
router.get("/shopfilter", userProductController.shopfilterProduct);
router.get("/about", userProductController.about);
router.get("/search", userProductController.search);

// Routes for user profile management
router.get("/profile", isAuth, checkUserStatus, profileController.profile);
router.get(
  "/view-addresses",
  isAuth,
  checkUserStatus,
  profileController.viewAddresses
);
router.get(
  "/edit-address/:id",
  isAuth,
  checkUserStatus,
  profileController.editAddress
);
router.get(
  "/delete-address/:id",
  isAuth,
  checkUserStatus,
  profileController.deleteAddress
);
router.get(
  "/set-active/:id",
  isAuth,
  checkUserStatus,
  profileController.setActiveAddress
);
router.post("/update-address-status/:id", isAuth, checkUserStatus, profileController.updateAddressStatus);
router.post(
  "/edit-address/:id",
  isAuth,
  checkUserStatus,
  profileController.editedAddress
);
router.get("/edit-profile", isAuth, profileController.renderEditProfilePage);
router.post(
  "/edit-profile",
  isAuth,
  checkUserStatus,
  profileController.updateProfile
);
router.get(
  "/change-password",
  isAuth,
  checkUserStatus,
  profileController.renderchangepassPage
);
router.post(
  "/password-change",
  isAuth,
  checkUserStatus,
  profileController.passschangevalid
);

// Routes for password change with OTP verification
router.get(
  "/changepassword",
  nocacheMiddleware(),
  otpController.otppagepasschange
);
router.post("/verifyOTPpass", nocacheMiddleware(), otpController.verifyOTPpass);
router.post("/resendOTPpass", nocacheMiddleware(), otpController.resendOTPpass);

// Routes for forgot password
router.get("/forgot-password", isAuthcommon, authController.forgotpassword);
router.post("/forgot-password", isAuthcommon, authController.forgotmail);
router.get("/forgototp", isAuthcommon, authController.forgototppage);
router.post("/verifyOTPforgot", isAuthcommon, otpController.verifyOTPforgot);
router.post("/resendOTPforgot", isAuthcommon, otpController.resendOTPforgot);
router.post(
  "/forgot-password/change",
  isAuthcommon,
  profileController.changeForgotPassword
);

// Routes for wishlist
router.post(
  "/add-to-wishlist/:productId",
  isAuth,
  checkUserStatus,
  wishlistController.addToWishlist
);
router.get(
  "/remove-from-wishlist/:productId",
  isAuth,
  checkUserStatus,
  wishlistController.removeFromWishlist
);
router.get(
  "/wishlist",
  isAuth,
  checkUserStatus,
  wishlistController.renderWishlistPage
);

// Routes for cart
router.get(
  "/add-to-cart",
  isAuth,
  checkUserStatus,
  addToCartController.renderCartPage
);
router.post(
  "/add-to-cart/:productId",
  isAuth,
  checkUserStatus,
  addToCartController.addToCart
);

router.get(
  "/remove-from-cart/:productId",
  isAuth,
  checkUserStatus,
  addToCartController.removeFromCart
);

router.post(
  "/remove-from-cart/:productId",
  isAuth,
  checkUserStatus,
  addToCartController.removeFromCart
);
router.post(
  "/checkout",
  checkoutMiddleware,
  isAuth,
  checkUserStatus,
  addToCartController.checkout
);

router.patch('/update-cart-quantity/:productId',
  checkoutMiddleware,
  isAuth,
  checkUserStatus,
  addToCartController.updateCartQuantity
)

// Routes for checkout and orders
router.get(
  "/orderviewaddresses",
  isAuth,
  checkUserStatus,
  orderController.orderviewaddresses
);
router.get(
  "/checkout",
  isAuth,
  checkUserStatus,
  checkoutMiddleware,
  checkoutController.renderCheckoutPage
);
router.post(
  "/place-order",
  isAuth,
  checkUserStatus,
  orderController.placeOrder
);
router.get(
  // "/set-activeorder/:id",
  "/set-activeorder/:id",
  isAuth,
  checkUserStatus,
  profileController.setActiveAddressorder
);
router.get(
  "/add-addressorder",
  isAuth,
  checkUserStatus,
  profileController.renderAddAddressPageorder
);
router.post(
  "/add-addressorder",
  isAuth,
  checkUserStatus,
  orderController.addAddressorder
);
router.post(
  "/checkout/place-order",
  isAuth,
  checkUserStatus,
  orderController.placeOrder
);
router.get(
  "/orders",
  isAuth,
  checkUserStatus,
  orderController.renderOrderListPage
);
router.post(
  // "/orders/cancel/:id",
  "/orders/cancel/:customOrderId",
  isAuth,
  checkUserStatus,
  orderController.cancelOrder
);

router.post(
  "/apply-coupon",
  isAuth,
  checkUserStatus,
  checkoutController.validateAndApplyCoupon
);

router.post(
  "/orders/cancel-product/:customOrderId/:productId",
  isAuth,
  checkUserStatus,
  orderController.cancelProduct
);

// Routes for wallet and payment
router.get("/wallet", isAuth, checkUserStatus, walletController.getWalletPage);
router.post(
  "/orders/return/:customOrderId",
  isAuth,
  checkUserStatus,
  orderController.returnOrderRequest
);
router.post(
  "/orders/return-product/:customOrderId/:productId",
  isAuth,
  checkUserStatus,
  orderController.returnProductRequest
);
router.post(
  "/process-payment",
  isAuth,
  checkUserStatus,
  orderController.processpayment
);
router.post(
  "/create-order",
  isAuth,
  checkUserStatus,
  orderController.createorder
);

router.post('/process-payment', isAuth,
  checkUserStatus, async (req, res) => {
  try {
    const paymentResponse = req.body.paymentResponse;

    // Process payment here (e.g., save payment details, update order status, etc.)

    // On successful payment processing
    res.redirect('/order-success');
  } catch (error) {
    console.error('Error processing payment:', error);
    res.redirect('/order-payment-fail');
  }
});

// Route to render the success page
router.get('/order-success', isAuth,
  checkUserStatus,orderController.orderSuccess);

// Route to render the failure page
router.get('/order-payment-fail', isAuth,
  checkUserStatus, (req, res) => {
  res.render('orderPaymentFail'); // Assuming you have this view
});

router.get(
  "/orders/:customOrderId/invoice",
  isAuth,
  checkUserStatus,
  orderController.invoice
);
router.post(
  "/repayment/process",
  isAuth,
  checkUserStatus,
  orderController.repayment
);
router.post(
  "/repayment/success",
  isAuth,
  checkUserStatus,
  orderController.repaymentOrderCreation
);
router.post("/payment-fail", isAuth, orderController.paymentFail);
router.post("/orderAbort/:customOrderId", isAuth, orderController.orderAbort);


module.exports = router;
