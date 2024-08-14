// adminCouponManagement.js

// Import the Coupon model
const Coupon = require("../../models/couponModel");
const Category = require("../../models/catergoryModel");

// Function to get all coupons
const getAllCoupons = async (req, res) => {
  try {
    // Get the page number from query parameters, default to 1 if not present
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = 5; // Number of coupons per page

    // Ensure page number is a positive integer
    if (page < 1) {
      return res.redirect('/admin/coupons?page=1');
    }

    // Fetch total number of coupons
    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / perPage);

    // Handle case where requested page number is greater than the total pages
    if (page > totalPages) {
      return res.redirect(`/admin/coupons?page=${totalPages}`);
    }

    // Fetch coupons for the current page
    const coupons = await Coupon.find()
      .skip((page - 1) * perPage)
      .limit(perPage);

    // Render the coupons page
    res.render("adminCoupon", {
      coupons: coupons,
      currentPage: page,
      totalPages: totalPages,
      messages: req.flash() // Pass flash messages to the template
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    req.flash('error', 'Error fetching coupons'); // Set error flash message
    res.redirect('/admin/coupons'); // Redirect back to coupons page
  }
};

// Function to create a new coupon
const createCoupon = async (req, res) => {
  try {
    // Extract coupon details from request body
    const {
      code,
      discountType,
      discountAmount,
      minPurchaseAmount,
      validFrom,
      validTo,
      oncePerUser,
    } = req.body;

    // Check for duplicate coupons
    const existingCoupon = await checkDuplicateCoupon(code);
    if (existingCoupon) {
      req.flash("error", "Coupon code already exists");
      return res.redirect("/admin/coupons");
    }

    // Create a new coupon object
    const newCoupon = new Coupon({
      code,
      discountType,
      discountAmount,
      minPurchaseAmount,
      validFrom,
      validTo,
      oncePerUser,
    });

    // Save the coupon to the database
    const savedCoupon = await newCoupon.save();
    await newCoupon.save();
    req.flash("success", "Coupon created successfully");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error creating coupon:", error);
    req.flash('error', 'Error creating coupon'); // Set error flash message
    res.redirect('/admin/coupons'); // Redirect back to coupons page
  }
};
// Function to check for duplicate coupons
const checkDuplicateCoupon = async (code) => {
  try {
    return await Coupon.findOne({
      code: new RegExp("^" + code + "$", "i"),
    });
  } catch (error) {
    console.error("Error checking for duplicate coupons:", error);
    throw error;
  }
};

// Function to update an existing coupon

const updateCoupon = async (req, res) => {
  try {
    // Check if all required fields are provided
    const {
      code,
      discountAmount,
      minPurchaseAmount,
      validFrom,
      validTo,
      oncePerUser,
    } = req.body;

    if (
      !code ||
      !discountAmount ||
      !minPurchaseAmount ||
      !validFrom ||
      !validTo ||
      oncePerUser === undefined
    ) {
      req.flash("error", "All required fields must be provided");
      return res.redirect("/admin/coupons");
    }

    const { id } = req.params; // Get coupon ID from request parameters

    // Check for duplicate coupons (excluding the current coupon)
    const existingCoupon = await checkDuplicateCoupon(code);
    if (existingCoupon && existingCoupon._id.toString() !== id) {
      req.flash("error", "Coupon code already exists");
      return res.redirect("/admin/coupons");
    }

    // Find the coupon by ID
    const coupon = await Coupon.findById(id);

    // Check if coupon exists
    if (!coupon) {
      req.flash("error", "Coupon not found");
      return res.redirect("/admin/coupons");
    }

    // Update coupon details
    coupon.code = code;
    coupon.discountAmount = discountAmount;
    coupon.minPurchaseAmount = minPurchaseAmount;
    coupon.validFrom = validFrom;
    coupon.validTo = validTo;
    coupon.oncePerUser = oncePerUser === "true";

    // Save the updated coupon
    await coupon.save();

    req.flash("success", "Coupon updated successfully");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error updating coupon:", error);
    req.flash('error', 'Error updating coupon'); // Set error flash message
    res.redirect('/admin/coupons'); // Redirect back to coupons page
  }
};
// Function to delete an existing coupon
const deleteCoupon = async (req, res) => {
  try {
    // Extract coupon ID from request parameters
    const couponId = req.params.id;

    // Find the coupon by ID and delete it
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      req.flash('error', 'Coupon not found'); // Set error flash message
    } else {
      req.flash('success', 'Coupon deleted successfully'); // Set success flash message
    }

    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    req.flash('error', 'Error deleting coupon'); // Set error flash message
    res.redirect('/admin/coupons'); // Redirect back to coupons page
  }
};

module.exports = {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};