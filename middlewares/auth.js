const User = require('../models/userSchema')
const userAuth = (req, res, next) => {
    const publicRoutes = ['/', '/login', '/register'];
    
    if (publicRoutes.includes(req.path)) {
        if (req.session.user) {
            User.findById(req.session.user)
                .then(user => {
                    if (user && !user.isBlocked) {
                        next(); 
                    } else {
                        req.session.destroy(err => {
                            if (err) {
                                console.error("Error destroying session:", err);
                                return res.status(500).json({ error: "Internal server error" });
                            }
                            console.log("Session forcefully destroyed successfully");
                            res.redirect('/login');
                        });
                    }
                })
                .catch(error => {
                    console.error("Error in user auth middleware:", error);
                    res.status(500).json({ error: "Internal server error" });
                });
        } else {
            next();
        }
    } else {
        if (req.session.user) {
            User.findById(req.session.user)
                .then(user => {
                    if (user && !user.isBlocked) {
                        next();
                    } else {
                        req.session.destroy(err => {
                            if (err) {
                                console.error("Error destroying session:", err);
                                return res.status(500).json({ error: "Internal server error" });
                            }
                            console.log("Session forcefully destroyed successfully");
                            res.redirect('/login');
                        });
                    }
                })
                .catch(error => {
                    console.error("Error in user auth middleware:", error);
                    res.status(500).json({ error: "Internal server error" });
                });
        } else {
            res.redirect('/login');
        }
    }
};


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in adminauth middleware",error);
        res.status(500).send("Internal server error")
        
    })
}

module.exports = {
    userAuth,
    adminAuth
}