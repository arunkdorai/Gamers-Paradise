const bcrypt = require("bcrypt");
const User = require("../../models/userModel");
const Product = require("../../models/productModel");
const categoryModel = require("../../models/catergoryModel");
const Address = require("../../models/addressModel");

//function for product view
const getProductView = async (req, res) => {
  try {
    // Retrieve the product ID from the request parameters
    const productId = req.params.productId;

    // Fetch the product details from the database based on the product ID
    const product = await Product.findById(productId);

    // Fetch similar products based on the category of the current product
    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
      status: true,
    }).limit(4);

    // Initialize a variable to hold the full name of the user
    let fullName = "";

    // Check if userData exists in session
    if (req.session.userData) {
      // If userData exists, extract the email from it
      const { email } = req.session.userData;

      // Find the user in the database based on the email
      const user = await User.findOne({ email, status: false });

      // If user exists, assign the full name to the variable
      if (user) {
        fullName = user.fullname;
      }
    }

    // Render the product view page and pass the product data, similar products, and full name to the template
    return res.render("productView", { product, similarProducts, fullName });
  } catch (error) {
    // Handle errors appropriately, such as redirecting to an error page
    res.redirect("/error");
  }
};

//function for render console page
const getConsoleProducts = async (req, res) => {
  try {
    let fullName = "";
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // Number of products per page
    const skip = (page - 1) * limit;
    const { price, sort } = req.query;

    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    // Find categories marked as "Console" that are active (status: true)
    const categories = await categoryModel.find({
      category: "Console",
      status: true,
    });

    if (!categories.length) {
      return res.render("console", { products: [], fullName });
    }

    // Prepare filter object
    let filter = {
      category: { $in: categories.map((cat) => cat.category) },
      status: true,
    };

    if (price) {
      const [min, max] = price.split("-").map(Number);
      filter.price = { $gte: min, $lte: max };
    }

    // Prepare sort options
    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions.price = 1;
        break;
      case "priceDesc":
        sortOptions.price = -1;
        break;
      case "ratings":
        sortOptions.ratings = -1;
        break;
      case "featured":
        sortOptions.featured = -1;
        break;
      case "newArrivals":
        sortOptions.createdAt = -1;
        break;
      case "aToZ":
        sortOptions.product = 1;
        break;
      case "zToA":
        sortOptions.product = -1;
        break;
      default:
        break;
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Create a query string for pagination links
    const filterQueryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

    const renderData = {
      products,
      fullName,
      currentPage: page,
      totalPages,
      filterQueryString,
      filters: req.query
    };

    res.render("console", renderData);
  } catch (error) {
    console.error("Failed to fetch console products:", error);
    res.status(500).send("Server error");
  }
};


//function for render games page
const getgamesProducts = async (req, res) => {
  try {
    let fullName = "";
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Number of products per page
    const skip = (page - 1) * limit;
    const { price, sort } = req.query;

    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({
      category: "Games",
      status: true,
    });

    if (!categories.length) {
      return res.render("games", { products: [], fullName });
    }

    let filter = {
      category: { $in: categories.map((cat) => cat.category) },
      status: true,
    };

    if (price) {
      const [min, max] = price.split("-").map(Number);
      filter.price = { $gte: min, $lte: max };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions.price = 1;
        break;
      case "priceDesc":
        sortOptions.price = -1;
        break;
      case "ratings":
        sortOptions.ratings = -1;
        break;
      case "featured":
        sortOptions.featured = -1;
        break;
      case "newArrivals":
        sortOptions.createdAt = -1;
        break;
      case "aToZ":
        sortOptions.product = 1;
        break;
      case "zToA":
        sortOptions.product = -1;
        break;
      default:
        break;
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const gamesProducts = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const filterQueryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

    const renderData = {
      products: gamesProducts,
      fullName,
      currentPage: page,
      totalPages,
      filterQueryString,
      filters: req.query
    };

    return res.render("games", renderData);
  } catch (error) {
    console.error("Error rendering games page:", error);
    res.status(500).send("Internal Server Error");
  }
};


//function for render computer page
const getcomputerProducts = async (req, res) => {
  try {
    let fullName = "";
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Number of products per page
    const skip = (page - 1) * limit;
    const { price, sort } = req.query;

    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({
      category: "Computer",
      status: true,
    });

    if (!categories.length) {
      return res.render("computer", { products: [], fullName });
    }

    let filter = {
      category: { $in: categories.map((cat) => cat.category) },
      status: true,
    };

    if (price) {
      const [min, max] = price.split("-").map(Number);
      filter.price = { $gte: min, $lte: max };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions.price = 1;
        break;
      case "priceDesc":
        sortOptions.price = -1;
        break;
      case "ratings":
        sortOptions.ratings = -1;
        break;
      case "featured":
        sortOptions.featured = -1;
        break;
      case "newArrivals":
        sortOptions.createdAt = -1;
        break;
      case "aToZ":
        sortOptions.product = 1;
        break;
      case "zToA":
        sortOptions.product = -1;
        break;
      default:
        break;
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const computerProducts = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const filterQueryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

    const renderData = {
      products: computerProducts,
      fullName,
      currentPage: page,
      totalPages,
      filterQueryString,
      filters: req.query
    };

    return res.render("computer", renderData);
  } catch (error) {
    console.error("Error rendering computer page:", error);
    res.status(500).send("Internal Server Error");
  }
};


//function for shop page
const getshopProducts = async (req, res) => {
  try {
    let fullName = "";

    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }
    // Assuming 'Shop' is a category or use a different check if needed
    const categories = await categoryModel.find({ status: true });

    if (!categories.length) {
      return res.render("shop", { categories, products: [], fullName });
    }

    const shopProducts = await Product.find({ status: true });

    return res.render("shop", {
      categories,
      products: shopProducts,
      fullName,
    });
  } catch (error) {
    console.error("Error rendering shop page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//function for render about page
const about = async (req, res) => {
  let fullName = "";

  // Check if userData exists in session
  if (req.session.userData) {
    // If userData exists, extract the email from it
    const { email } = req.session.userData;

    // Find the user in the database based on the email
    const user = await User.findOne({ email, status: false });

    // If user exists, assign the full name to the variable
    if (user) {
      fullName = user.fullname;
    }
  }

  // Render the console page and pass the console products data to the view
  return res.render("about", { fullName });
};

//function for render games page with sort/filter
const gamesfilterProduct = async (req, res) => {
  try {
    const { category, price, sort } = req.query;

    let filter = {};
    if (category) {
      filter.category = category;
    }
    if (price) {
      const [min, max] = price.split("-");
      filter.price = {
        $gte: parseInt(min),
        $lte: parseInt(max),
      };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions = { price: 1 };
        break;
      case "priceDesc":
        sortOptions = { price: -1 };
        break;
      case "ratings":
        sortOptions = { ratings: -1 };
        break;
      case "featured":
        sortOptions = { featured: -1 };
        break;
      case "newArrivals":
        sortOptions = { createdAt: -1 };
        break;
      case "aToZ":
        sortOptions = { product: 1 };
        break;
      case "zToA":
        sortOptions = { product: -1 };
        break;
      default:
        // Default sorting option or no sorting
        break;
    }

    let fullName = "";
    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({
      category: "Games",
      status: true,
    });

    if (!categories.length) {
      return res.render("games", { products: [], fullName });
    }

    const products = await Product.find(
      { status: true, category: "Games", ...filter },
      null,
      { sort: sortOptions }
    );
    res.render("games", { products, fullName });
  } catch (err) {
    console.error("Error filtering products:", err);
    res.status(500).send("Internal Server Error");
  }
};

//function for render console page with sort or filter
const consolefilterProduct = async (req, res) => {
  try {
    const { category, price, sort } = req.query;

    let filter = {};
    if (category) {
      filter.category = category;
    }
    if (price) {
      const [min, max] = price.split("-");
      filter.price = {
        $gte: parseInt(min),
        $lte: parseInt(max),
      };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions = { price: 1 };
        break;
      case "priceDesc":
        sortOptions = { price: -1 };
        break;
      case "ratings":
        sortOptions = { ratings: -1 };
        break;
      case "featured":
        sortOptions = { featured: -1 };
        break;
      case "newArrivals":
        sortOptions = { createdAt: -1 };
        break;
      case "aToZ":
        sortOptions = { product: 1 };
        break;
      case "zToA":
        sortOptions = { product: -1 };
        break;
      default:
        // Default sorting option or no sorting
        break;
    }

    let fullName = "";
    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({
      category: "console",
      status: true,
    });

    if (!categories.length) {
      return res.render("console", { products: [], fullName });
    }

    const products = await Product.find(
      { status: true, category: "console", ...filter },
      null,
      {
        sort: sortOptions,
      }
    );
    res.render("console", { products, fullName });
  } catch (err) {
    console.error("Error filtering products:", err);
    res.status(500).send("Internal Server Error");
  }
};

//function for render computer page with sort / filter
const computerfilterProduct = async (req, res) => {
  try {
    const { category, price, sort } = req.query;

    let filter = {};
    if (category) {
      filter.category = category;
    }
    if (price) {
      const [min, max] = price.split("-");
      filter.price = {
        $gte: parseInt(min),
        $lte: parseInt(max),
      };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions = { price: 1 };
        break;
      case "priceDesc":
        sortOptions = { price: -1 };
        break;
      case "ratings":
        sortOptions = { ratings: -1 };
        break;
      case "featured":
        sortOptions = { featured: -1 };
        break;
      case "newArrivals":
        sortOptions = { createdAt: -1 };
        break;
      case "aToZ":
        sortOptions = { product: 1 };
        break;
      case "zToA":
        sortOptions = { product: -1 };
        break;
      default:
        // Default sorting option or no sorting
        break;
    }

    let fullName = "";
    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({
      category: "computer",
      status: true,
    });

    if (!categories.length) {
      return res.render("computer", { products: [], fullName });
    }

    const products = await Product.find(
      { status: true, category: "computer", ...filter },
      null,
      {
        sort: sortOptions,
      }
    );
    res.render("computer", { products, fullName });
  } catch (err) {
    console.error("Error filtering products:", err);
    res.status(500).send("Internal Server Error");
  }
};


const shopfilterProduct = async (req, res) => {
  try {
    const { category, price, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Number of products per page
    const skip = (page - 1) * limit;

    let filter = { status: true };
    if (category) {
      filter.category = category;
    }

    if (price) {
      const [min, max] = price.split("-").map(Number);
      filter.price = { $gte: min, $lte: max };
    }

    let sortOptions = {};
    switch (sort) {
      case "priceAsc":
        sortOptions.price = 1;
        break;
      case "priceDesc":
        sortOptions.price = -1;
        break;
      case "ratings":
        sortOptions.ratings = -1;
        break;
      case "featured":
        sortOptions.featured = -1;
        break;
      case "newArrivals":
        sortOptions.createdAt = -1;
        break;
      case "aToZ":
        sortOptions.product = 1;
        break;
      case "zToA":
        sortOptions.product = -1;
        break;
      default:
        break;
    }

    let fullName = "";
    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    const categories = await categoryModel.find({ status: true });

    if (!categories.length) {
      return res.render("shop", { categories, products: [], fullName });
    }

    const queryObject = { status: true, ...filter };
    // const totalProducts = await Product.countDocuments(queryObject);
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    // const products = await Product.find(queryObject)
    //   .sort(sortOptions)
    //   .skip(skip)
    //   .limit(limit);
    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Create a query string for pagination links
    const filterQueryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

      const renderData = {
        categories,
        products,
        fullName,
        currentPage: page,
        totalPages,
        filterQueryString,
        filters: req.query
      };
  
      res.render("shop", renderData);
    } catch (err) {
      console.error("Error filtering products:", err);
      res.status(500).send("Internal Server Error");
    }
  };

//function for search option
const search = async (req, res) => {
  try {
    const { search, category } = req.query; // Use req.query for GET requests // Retrieve the search query from the request body


    let fullName = "";
    if (req.session.userData) {
      const { email } = req.session.userData;
      const user = await User.findOne({ email, status: false });

      if (user) {
        fullName = user.fullname;
      }
    }

    // Build the query
    let query = { status: true };

    if (search) {
      query.$or = [
        { product: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== '') {
      query.category = category;
    }

    // Perform the search
    const products = await Product.find(query);

    // Fetch categories for the dropdown
    const categories = await categoryModel.find({}, 'category');

    res.render("searchResult", { 
      products, 
      fullName, 
      categories,
      search,
      selectedCategory: category
    });
  } catch (error) {
    console.error("Error occurred while searching for products:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  about,
  getProductView,
  getConsoleProducts,
  getgamesProducts,
  getcomputerProducts,
  getshopProducts,
  gamesfilterProduct,
  computerfilterProduct,
  consolefilterProduct,
  shopfilterProduct,
  search,
};
