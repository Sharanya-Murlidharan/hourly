const userErrorHandler = (err, req, res, next) => {
    console.error("Error:", err.stack); 
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong!";

    res.setHeader("Cache-Control", "no-store");

    if (req.accepts("json")) {
        return res.status(statusCode).json({
            success: false,
            message,
        });
    } else {
        return res.status(statusCode).render("pageNotFound", {
            errorMessage: message,
            statusCode,
        });
    }
};

const adminErrorHandler = (err, req, res, next) => {
    console.error("Admin Error:", err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong!";

    res.setHeader("Cache-Control", "no-store");

    if (req.accepts("json")) {
        return res.status(statusCode).json({
            success: false,
            message,
        });
    } else {
        return res.status(statusCode).render("admin/pageError", {
            statusCode,
            errorMessage: message,
        });
    }
};

module.exports={adminErrorHandler,userErrorHandler}