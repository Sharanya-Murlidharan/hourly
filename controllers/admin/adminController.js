const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const pageerror = async(req,res)=>{
    res.render("404-error")
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard'); 
    }
    res.render('admin-login', { message: null });
};

const login=async(req,res)=>{
    try{
        const {email,password}=req.body;
        console.log(email,password);
        
        const admin=await User.findOne({email,isAdmin:true})
        console.log(admin);
        
        if(admin){
            const passwordmatch = await bcrypt.compare(password, admin.password);
            if(passwordmatch){   
                req.session.admin=admin
                req.session.Mess="Admin Login Successfully";
                return res.redirect("/admin/dashBoard");
            }else{
                req.session.Mes={type:"error",text:"Password do not match"}
                return res.redirect("/admin/login");
            }
        }else{
            req.session.Mes={type:"error",text:"INVALID ADMIN"}
            return res.redirect("/admin/login")
        }
    }catch(error){
       console.error("login error",error);
       return res.redirect("/admin/pagenotFounderror");
    }
}


const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render("dashBoard");
        } catch (error) {
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/admin/login"); // Redirect to login if not admin
    }
};

const logout = async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroyin session",err);
                return res.redirect("/pageerror")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout",error);
        res.redirect("/pageerror")
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
};