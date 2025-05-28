const User = require("../../models/userSchema");

const customerInfo = async (req, res, next) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 4;

    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: new RegExp(search, "i") } },
        { email: { $regex: new RegExp(search, "i") } }
      ]
    })
      .sort({ createdOn: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: new RegExp(search, "i") } },
        { email: { $regex: new RegExp(search, "i") } }
      ]
    });

    res.render('customers', {
      users: userData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      searchQuery: search
    });
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const customerBlocked = async (req, res, next) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/users");
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

const customerunBlocked = async (req, res, next) => {
  try {
    const id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/users");
  } catch (error) {
    error.statusCode = 500;
    next(error);
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked
};