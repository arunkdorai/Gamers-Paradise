const express = require("express"); // Importing the express module
const router = express.Router(); // Creating a new router instance

// Importing the required controllers
const adminController = require("../../controllers/admin/adminController");
const userManagementController = require("../../controllers/admin/userManagement");
const categoryManagement = require("../../controllers/admin/catergoryManagement");
const productManagement = require("../../controllers/admin/productManagement");
const orderManagement = require("../../controllers/admin/orderManagement");

// Importing the required middleware
const adminAuth = require("../../middleware/adminAuth");
const storage = require("../../middleware/multer");
const nocacheMiddleware = require("../../middleware/noCache");

// Admin routes
router.get("/", nocacheMiddleware(), adminController.admin);
router.post("/", adminController.checkAdmin);
router.get("/adminHome", adminAuth.isLogin, adminController.adminDashboard);
router.get("/Orders", (req, res) => {
  res.render("adminOrders");
});

// User management routes
router.get(
  "/User",
  adminAuth.isLogin,
  userManagementController.userManagementPage
);
router.get(
  "/changeStatus",
  adminAuth.isLogin,
  userManagementController.changeStatus
);
router.get("/logout", adminController.adminLogout);

// Category management routes
router.get("/Category", adminAuth.isLogin, categoryManagement.getCategory);
router.get(
  "/categoryStatus",
  adminAuth.isLogin,
  categoryManagement.changeStatus
);
router.post("/editCategory", categoryManagement.editCategory);
router.post("/category", categoryManagement.addCategory);

// Product management routes
router.get("/Product", adminAuth.isLogin, productManagement.getProduct);
router.get("/Product-add", adminAuth.isLogin, productManagement.productAddPage);
router.post(
  "/addProduct",
  storage.array("images", 5),
  productManagement.addProduct
);
router.get("/productstatus", adminAuth.isLogin, productManagement.changeStatus);
router.post(
  "/editProduct/:id",
  storage.array("images", 5),
  productManagement.editProduct
);

// Order management routes
router.get(
  "/order",
  adminAuth.isLogin,
  orderManagement.getOrdersWithPagination
);
router.post(
  "/changeOrderStatus",
  adminAuth.isLogin,
  orderManagement.changeOrderStatus
);
router.get("/logout", adminController.adminLogout);
router.post(
  "/cancelOrder/:orderId",
  adminAuth.isLogin,
  orderManagement.cancelOrder
);
router.post(
  "/orders/cancel-product/:orderId/:productId",
  orderManagement.cancelProductAsAdmin
);

module.exports = router; // Exporting the router
