const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require('dotenv').config()
const session = require('express-session')

function generateOtp() {
    const digits = '1234567890'
    let otp = ''
    for(let i = 0;i<6;i++){
        otp+= digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const sendVerificationEmail = async(email,otp)=>{
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })
        const mailOptions = {
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP :${otp}</h4><br></b>`
        }
        const info = await transporter.sendMail(mailOptions)
        console.log('emailsent:',info.messageId);
        console.log('otp:',otp);
        
        return true
    } catch (error) {
        console.error('Error sending email ', error);
        return false
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const getForgotPassword = async(req,res)=>{
    try {
        res.render("forgot-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                req.session.otpExpires = Date.now() + 30 * 1000;
                return res.json({ success: true, redirectUrl: "/forgotpass-otp" });
            } else {
                return res.json({ success: false, message: "Failed to send OTP. Please try again" });
            }
        } else {
            return res.json({ success: false, message: "User with this email does not exist" });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        return res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

const forgotPassOtp = async(req,res)=>{
    try {
        res.render("forgotpass-otp")
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp
        if (enteredOtp === req.session.userOtp) {
            res.json({success:true,redirectUrl:"/reset-password"})
        }else{
            res.json({success:false,message:"OTP not matching"})
        }
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured please try again"})
    }
}

const getResetPassPage = async(req,res)=>{
    try {
        res.render('reset-password')
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please start the password reset process again." });
        }

        if (newPass1 !== newPass2) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        const passwordHash = await securePassword(newPass1);
        await User.updateOne(
            { email: email },
            { $set: { password: passwordHash } }
        );

        // Clear the session data after successful password reset
        req.session.email = null;
        req.session.userOtp = null;
        req.session.otpExpires = null;

        return res.status(200).json({ success: true, message: "Password successfully changed!" });
    } catch (error) {
        console.error("Error in postNewPassword:", error);
        return res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;

        const email = req.session.email;
        if (!email) {
            console.error('Email not found in session');
            return res.status(400).json({ success: false, message: "Email session missing" });
        }

        console.log('Resending otp to email:', email);

        const emailSent = await sendVerificationEmail(email, otp);
        console.log("emailSent result:", emailSent);
        console.log('otp:',otp);
        

        if (emailSent) {
            console.log("resend otp: ", otp);
            return res.status(200).json({ success: true, message: "Resend OTP successful" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

    } catch (error) {
        console.error('Error in resendOtp:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const userProfile = async (req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const addressData = await Address.findOne({userId : userId})
        res.render('profile',{
            user:userData,
            userAddress:addressData
        })
    } catch (error) {
        console.log('user profile error:',error);
        res.redirect('/pageNotFound')
        
    }
}

const changeEmail= async(req,res)=>{
    try {
        res.render('change-email')
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changeEmailValid = async(req,res)=>{
    try {
        const {email} = req.body
        const userExists = await User.findOne({email})
        if(userExists){
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email,otp)
            if (emailSent) {
                req.session.userOtp = otp
                req.session.userData = req.body
                req.session.email = email 
                res.render("change-email-otp")
                console.log('Email sent',email);
                console.log('OTP:',otp);
            }else{
                res.json("email-error")
            }
        }else{
            res.render("change-email",{
                message:"User with this email does not exist"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const verifyEmailOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp
        if (enteredOtp===req.session.userOtp) {
            req.session.userData = req.body.userData
            res.render('new-email',{
                userData:req.session.userData
            })
        }else{
            res.render('change-email-otp',{
                message:"OTP not matching",
                userData : req.session.userData
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const updateEmail = async(req,res)=>{
    try {
        const newEmail = req.body.newEmail
        const userId = req.session.user
        await User.findByIdAndUpdate(userId,{email:newEmail})
        res.redirect('/editProfile')
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const newEmailPage = async(req,res)=>{
    try {
        res.render('new-email')
    } catch (error) {
        console.log('error from newemailpage',error)
    }
} 

const changePassword = async(req,res)=>{
    try {
        res.render('change-password')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const changePaawordValid = async(req,res)=>{
    try {
        const {email}=req.body
        const userExists = await User.findOne({email})
        if (userExists) {
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email,otp)
            if (emailSent) {
                req.session.userOtp = otp
                req.session.userData = req.body
                req.session.email = email
                res.render('change-password-otp')
                console.log('OTP:',otp);
            }else{
                res.json({
                    success:false,
                    message:"Failed to send OTP.Please try again"
                })
            }
        }else{
            res.render("change-password",{
                message:"User with this email does not exist."
          })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
        console.log("Error from change password valid",error);
        
    }
}

const verifyChangePassOtp = async(req,res)=>{
    try {
        
    } catch (error) {
        
    }
}

// New function for direct password update
const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Step 1: Validate that all fields are provided
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.render('change-password', {
                message: 'All fields are required.'
            });
        }

        // Step 2: Validate that newPassword and confirmPassword match
        if (newPassword !== confirmPassword) {
            return res.render('change-password', {
                message: 'New password and confirm password do not match.'
            });
        }

        // Step 3: Retrieve the logged-in user
        const userId = req.session.user;
        if (!userId) {
            return res.render('change-password', {
                message: 'User session not found. Please log in again.'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.render('change-password', {
                message: 'User not found.'
            });
        }

        // Step 4: Verify the current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.render('change-password', {
                message: 'Current password is incorrect.'
            });
        }

        // Step 5: Hash the new password and update the user
        const hashedNewPassword = await securePassword(newPassword);
        user.password = hashedNewPassword;
        await user.save();

        // Step 6: Render success message
        res.render('change-password', {
            message: 'Password updated successfully!'
        });

    } catch (error) {
        console.log("Error in updatePassword:", error);
        res.redirect("/pageNotFound");
    }
};

const editProfile = async(req,res)=>{
    try {
    const userId = req.session.user
    const userData = await User.findById(userId)
    res.render('edit-profile',{
        user:userData
    })
} catch (error) {
    console.log('edit profile error:',error);
    res.redirect('/pageNotFound')
    
}
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.render('login', {
                message: 'User session not found. Please log in again.'
            });
        }

        const { name, phone } = req.body;

        // Validate input
        if (!name || !phone) {
            return res.render('edit-profile', {
                user: req.body,
                message: 'Name and phone are required.'
            });
        }

        // Validate name (letters and spaces only)
        if (!/^[a-zA-Z\s]+$/.test(name)) {
            return res.render('edit-profile', {
                user: req.body,
                message: 'Name should contain only letters and spaces.'
            });
        }

        // Validate phone (10 digits)
        if (!/^\d{10}$/.test(phone)) {
            return res.render('edit-profile', {
                user: req.body,
                message: 'Phone number must be a 10-digit number.'
            });
        }

        // Prepare update data
        const updateData = { name, phone };

        // Handle profile image if uploaded
        if (req.file) {
            updateData.profileImage = `/Uploads/profile-images/${req.file.filename}`;
        }

        // Update user in the database
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.render('edit-profile', {
                user: req.body,
                message: 'User not found.'
            });
        }

        // Render profile page with success message
        res.render('profile', {
            user: updatedUser,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.render('edit-profile', {
            user: req.body,
            message: error.message || 'Failed to update profile'
        });
    }
};

const getAddress = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const userAddress = await Address.findOne({ userId })
        res.render('address',{
            user:userData,
             addresses: userAddress ? userAddress.address : [],
            addressSaved: req.query.addressSaved === 'true'
        })
    } catch (error) {
        res.redirect("/pageNotFound")
        console.log('error from get address: ',error);
        
    }
}

const addAddress = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)

        res.render('add-address',{
            user:userData
        })
    } catch (error) {
        console.log('error from add address:',error);
        res.redirect("/pageNotFound")
    }
}

const postAddAddress = async (req, res) => {
    try {
        // Get user ID from session
        const userId = req.session.user;
        if (!userId) {
            console.log('No user ID in session, redirecting to login');
            return res.redirect('/login');
        }

        // Find the user
        const userData = await User.findById(userId).exec();
        if (!userData) {
            console.log(`User not found for ID: ${userId}`);
            return res.redirect('/login');
        }

        // Extract fields from the request body (align with frontend)
        const { fullName, phone, altPhone, street, city, state, pin, country } = req.body;

        const addressData = {
            name: fullName,      
            city,
            landMark: street,    
            state,
            pincode: pin,        
            phone,
            altPhone,
            country
        };

        // Find or create the user's address document
        let userAddress = await Address.findOne({ userId: userData._id })
        if (!userAddress) {
            userAddress = new Address({
                userId: userData._id, // Store only the userId, not the entire user object
                address: [addressData]
            });
        } else {
            userAddress.address.push(addressData);
        }

        await userAddress.save();
        console.log(`Address saved successfully for user: ${userId}`);
        res.redirect('/address');

    } catch (error) {
        console.error('Error in postAddAddress:', error.message, error.stack);
        res.redirect("/pageNotFound")
    }
};

const editAddress = async(req,res)=>{
    try {
        const addressId = req.query.id
        const user = req.session.user
        const currentAddress = await Address.findOne({
            "address._id" : addressId
        })
        if (!currentAddress) {
            return res.redirect("/pageNotFound")
        }
        const addressData = currentAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString()
        })
        if (!addressData) {
            return res.redirect("/pageNotFound")
        }
        res.render('edit-address',{
            address:addressData,
            user:user,
            addressId: addressId
        })
    } catch (error) {
        console.log("error from editAddress: ",error);
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const userId = req.session.user;

        const userData = await User.findById(userId).exec();
        if (!userData) {
            return res.redirect('/login');
        }

        const findAddress = await Address.findOne({ "address._id": addressId }).exec();
        if (!findAddress) {
            
            return res.redirect("/pageNotFound"); // Exit after redirect
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        name: data.fullName, // Match frontend field name
                        city: data.city,
                        landMark: data.street, // Match frontend field name
                        state: data.state,
                        pincode: data.pin, // Match frontend field name
                        phone: data.phone,
                        altPhone: data.altPhone,
                        country:data.country
                    }
                }
            }
        );

        res.redirect("/address?addressUpdated=true");
    } catch (error) {
        console.error("Error from postEditAddress:", error);
        res.status(500).render('edit-address', {
            generalError: 'An error occurred while updating the address. Please try again.',
            address: req.body,
            addressId: req.query.id
        });
    }
};

const deleteAddress = async(req,res)=>{
    try {
        const addressId = req.query.id
        const findAddress = await Address.findOne({"address._id":addressId})
        if (!findAddress) {
            return res.status(404).send("Address not found")
        }
        await Address.updateOne({
            "address._id":addressId
        },
        {
            $pull:{
                address:{
                    _id:addressId,
                }
            }
        }
    )
    res.redirect("/address")
    } catch (error) {
        console.log('error from delete address: ',error);
        res.redirect("/pageNotFound")
    }
}



module.exports={
    getForgotPassword,
    forgotEmailValid,
    forgotPassOtp,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    newEmailPage,
    changePassword,
    changePaawordValid,
    verifyChangePassOtp,
    updatePassword,
    editProfile,
    updateProfile,
    getAddress,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
}