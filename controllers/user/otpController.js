const bcrypt = require("bcrypt");
const User = require("../../models/userModel");
const { sendOTP } = require("../../helpers/otpService");
const Product = require("../../models/productModel");
const categoryModel = require("../../models/catergoryModel");
const Address = require("../../models/addressModel");

// Function to render OTP page
const otppage = async (req, res) => {
  if (req.session.isAuth) {
    res.redirect("/");
  } else {
    const { email } = req.query; // Retrieve email from query parameters
    const { errorMessage } = req.session; // Retrieve error message from session

    // Clear the session error message
    delete req.session.errorMessage;

    // Check if there's an error message
    if (errorMessage) {
      // If there's an error message, render the OTP page without generating OTP and without timer
      return res.render("otp", { showTimer: false, email, errorMessage });
    } else {
      // If there's no error message, render the OTP page with timer and generate OTP
      res.render("otp", { showTimer: true, email, errorMessage: "" });
    }
  }
};

// Function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

// Function to verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userData = req.session.userData;
    const showTimer = true;

    // Check if timer has expired
    if (!req.session.otp || !req.session.currentTimestamp) {
      return res.render("otp", {
        email,
        otp: null,
        errorMessage: "OTP validation timeout. Please resend OTP.",
        showTimer: false,
      });
    }

    // Implement logic to verify OTP if timer has not expired
    if (otp === req.session.otp.toString()) {
      const newTimestamp = Date.now();
      const timeElapsed = newTimestamp - req.session.currentTimestamp;

      // Check if time elapsed is less than or equal to 60 seconds (60000 milliseconds)
      if (timeElapsed <= 60000) {
        // OTP is verified, save user to database
        const newUser = new User(userData);
        await newUser.save();
        const email = userData.email;

        // If user exists, assign the full name to the variable

        let fullName = newUser.fullname;

        // Clear session data
        const user=await User.findById(newUser._id)
        req.session.userData = user;
        req.session.user = email;
        delete req.session.otp;
        delete req.session.currentTimestamp;

        req.session.isAuth = true;
        return res.redirect("/");
      } else {
        return res.render("otp", {
          showTimer: false,
          email,
          errorMessage: "Timer expired. Please resend OTP.",
        });
      }
    } else {
      // Invalid OTP
      return res.render("otp", {
        showTimer: false,
        email,
        errorMessage: "Invalid OTP",
      });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).render("otp", {
      showTimer: false,
      email: "",
      errorMessage: "Failed to verify OTP",
    });
  }
};

// Function to resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const otp = generateOTP();

    // Update session with new OTP
    req.session.otp = otp;

    // Resend OTP to user's phone
    await sendOTP(phone, otp);
    req.session.currentTimestamp = Date.now();

    // Respond with success message and restart timer
    res.render("otp", {
      showTimer: true,
      email, otp,
      errorMessage: "OTP has been resent successfully.",
    });
  } catch (error) {
    console.error("OTP resend error:", error);
    res.status(500).render("otp", {
      showTimer: false,
      email,
      errorMessage: "Failed to resend OTP",
    });
  }
};

// Function to resend OTP for password change
const resendOTPpass = async (req, res) => {
  try {
    const { email, phone } = req.session.userData;
    const otp = generateOTP();

    // Update session with new OTP
    req.session.otp = otp;

    // Resend OTP to user's phone
    await sendOTP(phone, otp);
    req.session.currentTimestamp = Date.now();

    // Respond with success message and restart timer
    res.render("changepassword", {
      showTimer: true,
      email, otp,
      errorMessage: "OTP has been resent successfully.",
    });
  } catch (error) {
    console.error("OTP resend error:", error);
    res.status(500).render("changepassword", {
      errorMessage: "Failed to resend OTP",
    });
  }
};

// Function to verify OTP for password change
const verifyOTPpass = async (req, res) => {
  try {
    const { otp } = req.body;
    const userData = req.session.userData;

    // Check if timer has expired
    if (!req.session.otp || !req.session.currentTimestamp) {
      return res.render("changepassword", {
        email: userData.email,
        otp: null,
        errorMessage: "OTP validation timeout. Please resend OTP.",
        showTimer: false,
      });
    }

    // Implement logic to verify OTP if timer has not expired
    if (otp === req.session.otp.toString()) {
      const newTimestamp = Date.now();
      const timeElapsed = newTimestamp - req.session.currentTimestamp;

      // Check if time elapsed is less than or equal to 60 seconds (60000 milliseconds)
      if (timeElapsed <= 60000) {
        // OTP is verified, save user to database
        const user = await User.findById(userData._id); // Find user by ID
        if (!user) {
          return res.status(400).render("changepassword", {
            errorMessage: "User not found"
          });
        }

        // Update user's password
        user.password = await bcrypt.hash(req.session.newPassword, 10);
        await user.save();

        // Clear session data
        delete req.session.otp;
        delete req.session.currentTimestamp;
        delete req.session.newPassword;

        return res.redirect("/profile");
      } else {
        return res.render("changepassword", {
          showTimer: false,
          email: userData.email,
          errorMessage: "Timer expired. Please resend OTP.",
        });
      }
    } else {
      // Invalid OTP
      return res.render("changepassword", {
        showTimer: false,
        email: userData.email,
        errorMessage: "Invalid OTP",
      });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).render("changepassword", {
      showTimer: false,
      email: "",
      errorMessage: "Failed to verify OTP",
    });
  }
};



//function for rendering otp page for password change
const otppagepasschange = async (req, res) => {
  const { email } = req.query; // Retrieve email and otp from query parameters
  const { errorMessage } = req.session; // Retrieve error message from session

  // Clear the session error message
  delete req.session.errorMessage;

  // Check if there's an error message
  if (errorMessage) {
    // If there's an error message, render the OTP page without generating OTP and without timer
    return res.render("changepassword", {
      showTimer: false,
      email,
      errorMessage,
    });
  } else {
    // If there's no error message, render the OTP page with timer and generate OTP
    res.render("changepassword", { showTimer: true, email, errorMessage: "" }); // Passing email and otp variables to the "otp.ejs" view
  }
};

// Function to resend OTP for forgot password
const resendOTPforgot = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.email });

    if (!user) {
      return res.status(400).render("forgototp", {
        showTimer: false,
        email: req.session.email,
        errorMessage: "User not found",
      });
    }

    const otp = generateOTP();
    const phone = user.phone;

    // Update session with new OTP
    req.session.otp = otp;

    // Resend OTP to user's phone
    await sendOTP(phone, otp);
    req.session.currentTimestamp = Date.now();

    // Respond with success message and restart timer
    res.render("forgototp", {
      showTimer: true,
      email: req.session.email,
      errorMessage: "OTP has been resent successfully.",
    });
  } catch (error) {
    console.error("OTP resend error:", error);
    res.status(500).render("forgototp", {
      errorMessage: "Failed to resend OTP",
    });
  }
};

// Function to verify OTP for forgot password
const verifyOTPforgot = async (req, res) => {
  try {
    const { otp } = req.body;

    // Check if timer has expired
    if (!req.session.otp || !req.session.currentTimestamp) {
      return res.render("forgototp", {
        email: req.session.email,
        otp: null,
        errorMessage: "OTP validation timeout. Please resend OTP.",
        showTimer: false,
      });
    }

    // Implement logic to verify OTP if timer has not expired
    if (otp === req.session.otp.toString()) {
      const newTimestamp = Date.now();
      const timeElapsed = newTimestamp - req.session.currentTimestamp;

      // Check if time elapsed is less than or equal to 60 seconds (60000 milliseconds)
      if (timeElapsed <= 60000) {
        // OTP is verified, save user to database
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
          return res.status(400).render("forgototp", {
            showTimer: false,
            email: req.session.email,
            errorMessage: "User not found",
          });
        }

        return res.render("forgotpasschange", { errorMessage: "" });
      } else {
        return res.render("forgototp", {
          showTimer: false,
          email: req.session.email,
          errorMessage: "Timer expired. Please resend OTP.",
        });
      }
    } else {
      // Invalid OTP
      return res.render("forgototp", {
        showTimer: false,
        email: req.session.email,
        errorMessage: "Invalid OTP",
      });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).render("forgototp", {
      showTimer: false,
      email: "",
      errorMessage: "Failed to verify OTP",
    });
  }
};

module.exports = {
  resendOTPforgot,
  verifyOTPforgot,
  otppagepasschange,
  verifyOTPpass,
  resendOTPpass,
  generateOTP,
  verifyOTP,
  resendOTP,
  otppage,
};

