const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const Wallet = require("../models/walletSchema")
const env = require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // This MUST match exactly what's in your Google Console
      callbackURL: "http://hourrly.shop/auth/google/callback",
      passReqToCallback: true,
    },
    async (req,accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        } else {
          let referralCode = null;
          if (req.query.state) {

            const stateData = JSON.parse(req.query.state);
            referralCode = stateData.referralCode;
            
          }


          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });

          const saveUserData = await user.save();
          const newUserWallet = new Wallet({
            userId: saveUserData._id,
            balance: 0,
            transactions: [],
          });
          await newUserWallet.save();
          if (referralCode) {
            // Validate the referral code
            const referrer = await User.findOne({
              referralCode: referralCode,
              isBlocked: false,
            });
            if (!referrer) {
               return done(null, user);
            }

          
            newUserWallet.balance += 500;
            newUserWallet.transactions.push({
              amount: 500,
              type: "credit",
              description: `Referral bonus for signing up with code ${referralCode}`,
              date: new Date(),
            });
            await newUserWallet.save();

            // Reward the existing user (referrer): 1000 in wallet
            let referrerWallet = await Wallet.findOne({ userId: referrer._id });
            if (!referrerWallet) {
              referrerWallet = new Wallet({
                userId: referrer._id,
                balance: 0,
                transactions: [],
              });
            }
            referrerWallet.balance += 1000;
            referrerWallet.transactions.push({
              amount: 1000,
              type: "credit",
              description: `Referral reward for inviting user ${user.name}`,
              date: new Date(),
            });
            await referrerWallet.save();

            // Update referrer's redeemedUsers and redeemed status
            referrer.redeemedUsers.push(saveUserData._id);
            referrer.redeemed = true;
            await referrer.save();

            // Update new user's redeemed status
            saveUserData.redeemed = true;
            await saveUserData.save();
          }
          return done(null, user);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

module.exports = passport;
