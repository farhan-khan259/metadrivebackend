require("dotenv").config();
const User = require("../models/User");
const Plan = require("../models/plain");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

// ================== 🔐 ADMIN CREDENTIALS (SECURELY FROM .ENV) ==================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH; // ✅ CHANGED TO HASH

// ================== 📧 EMAIL TRANSPORTER ==================
const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

// ================== 🧾 SIGNUP ==================
// exports.signup = async (req, res) => {
//      try {
//              const { fullName, email, password, refercode, whatsappNumber } = req.body;

//              // Check for existing user
//              const existingUser = await User.findOne({ email });
//              if (existingUser) {
//                      return res.status(400).json({ message: "Email already registered" });
//              }

//              // Referral check
//              if (refercode) {
//                      const refUser = await User.findOne({ randomCode: refercode });
//                      if (!refUser) {
//                              return res.status(400).json({ message: "Invalid referral code" });
//                      }
//              }

//              // Hash password before saving
//              const hashedPassword = await bcrypt.hash(password, 10);

//              const newUser = new User({
//                      fullName,
//                      email,
//                      password: hashedPassword,
//                      whatsappNumber,
//                      referredBy: refercode,
//              });
//              await newUser.save();

//              // Add referral link
//              if (refercode) {
//                      const refUser = await User.findOne({ randomCode: refercode });
//                      if (refUser) {
//                              refUser.team.push(newUser.randomCode);
//                              await refUser.save();
//                      }
//              }

//              res.status(201).json({
//                      message: "User registered successfully",
//                      user: newUser,
//                      userPlanlength: 0,
//              });
//      } catch (err) {
//              res.status(500).json({ message: err.message });
//      }
// };


// exports.signup = async (req, res) => {
//      try {
//              const { fullName, email, password, refercode, whatsappNumber } = req.body;

//              // Check for existing user
//              const existingUser = await User.findOne({ email });
//              if (existingUser) {
//                      return res.status(400).json({ message: "Email already registered" });
//              }

//              // ✅ MANDATORY Referral check
//              if (!refercode) {
//                      return res.status(400).json({ message: "Referral code is required" });
//              }

//              // Validate referral code
//              const refUser = await User.findOne({ randomCode: refercode });
//              if (!refUser) {
//                      return res.status(400).json({ message: "Invalid referral code" });
//              }

//              // Hash password before saving
//              const hashedPassword = await bcrypt.hash(password, 10);

//              const newUser = new User({
//                      fullName,
//                      email,
//                      password: hashedPassword,
//                      whatsappNumber,
//                      referredBy: refercode,
//              });
//              await newUser.save();

//              // Add referral link
//              if (refercode) {
//                      const refUser = await User.findOne({ randomCode: refercode });
//                      if (refUser) {
//                              refUser.team.push(newUser.randomCode);
//                              await refUser.save();
//                      }
//              }

//              res.status(201).json({
//                      message: "User registered successfully",
//                      user: newUser,
//                      userPlanlength: 0,
//              });
//      } catch (err) {
//              res.status(500).json({ message: err.message });
//      }
// };


exports.signup = async (req, res) => {
	try {
		const { fullName, email, password, refercode, whatsappNumber } = req.body;

		// ✅ Validate required fields
		if (!fullName || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "Full name, email, and password are required"
			});
		}

		// Check for existing user
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({
				success: false,
				message: "Email already registered"
			});
		}

		// Get total user count
		const userCount = await User.countDocuments();
		const isFirstUser = userCount === 0;

		console.log(`👤 Signup attempt: ${email} | First User: ${isFirstUser} | Referral: ${refercode || 'None'}`);

		// 🔒 STRICT: Block if no referral code and not first user
		if (!isFirstUser) {
			if (!refercode) {
				return res.status(400).json({
					success: false,
					message: "Referral code is mandatory. You cannot sign up without a valid referral code from an existing user."
				});
			}

			// Validate referral code exists
			const referredByUser = await User.findOne({ randomCode: refercode });
			if (!referredByUser) {
				return res.status(400).json({
					success: false,
					message: "Invalid referral code. This code does not exist in our system."
				});
			}

			console.log(`✅ Referral code validated: ${refercode} belongs to ${referredByUser.fullName}`);
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Generate random code for the new user
		const randomCode = generateRandomCode();
		console.log(`🆕 Generated user code: ${randomCode}`);

		// Create new user
		const newUser = new User({
			fullName,
			email,
			password: hashedPassword,
			whatsappNumber: whatsappNumber || "",
			referredBy: refercode || null,
			randomCode: randomCode,
			role: isFirstUser ? 'admin' : 'user',
			userbalance: 0,
			UserInvestment: 0,
			userTotalDeposits: 0,
			userTotalWithdrawals: 0,
			totalEarnings: 0,
			totalCommissionEarned: 0,
			team: []
		});

		await newUser.save();
		console.log(`✅ User saved to database: ${newUser.email}`);

		// Update referrer's team if applicable
		if (refercode) {
			const referredByUser = await User.findOne({ randomCode: refercode });
			if (referredByUser) {
				referredByUser.team.push(newUser.randomCode);
				await referredByUser.save();
				console.log(`✅ Added ${newUser.randomCode} to ${referredByUser.fullName}'s team`);
			}
		}

		// Generate JWT token
		const token = jwt.sign(
			{ userId: newUser._id, email: newUser.email },
			process.env.JWT_SECRET || "fallback-secret-key",
			{ expiresIn: "30d" }
		);

		const responseMessage = isFirstUser
			? `🎉 First admin account created successfully! Your referral code: ${newUser.randomCode}`
			: `✅ Account created successfully! Your referral code: ${newUser.randomCode}`;

		res.status(201).json({
			success: true,
			message: responseMessage,
			user: {
				_id: newUser._id,
				fullName: newUser.fullName,
				email: newUser.email,
				randomCode: newUser.randomCode,
				role: newUser.role,
				userbalance: newUser.userbalance,
				referredBy: newUser.referredBy,
				whatsappNumber: newUser.whatsappNumber
			},
			token,
			isFirstUser: isFirstUser
		});

		console.log(`🎊 Registration completed: ${newUser.fullName} (${newUser.role})`);

	} catch (err) {
		console.error('❌ Signup error:', err);

		// Handle duplicate key errors
		if (err.code === 11000) {
			return res.status(400).json({
				success: false,
				message: "User with this email or referral code already exists"
			});
		}

		// Handle validation errors
		if (err.name === 'ValidationError') {
			const errors = Object.values(err.errors).map(val => val.message);
			return res.status(400).json({
				success: false,
				message: `Validation error: ${errors.join(', ')}`
			});
		}

		res.status(500).json({
			success: false,
			message: "Server error during registration. Please try again."
		});
	}
};

// Random code generator function
function generateRandomCode() {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';

	// Generate 8-character code
	for (let i = 0; i < 8; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}

	// Ensure uniqueness (basic check)
	console.log(`🔑 Generated code: ${result}`);
	return result;
}

// // ================== 🔑 LOGIN ==================

// exports.login = async (req, res) => {
//      try {
//              const { email, password } = req.body;

//              // ✅ Admin login (plaintext check)
//              if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
//                      const token = jwt.sign(
//                              { role: "admin", email },
//                              process.env.JWT_SECRET,
//                              { expiresIn: "1d" }
//                      );

//                      return res.status(200).json({
//                              success: true,
//                              message: "Admin login successful",
//                              user: { email, role: "admin" },
//                              token,
//                              userPlanlength: 0,
//                      });
//              }

//              // ✅ Regular user login (bcrypt check)
//              const user = await User.findOne({ email });
//              if (!user) {
//                      return res.status(404).json({ success: false, message: "User not found" });
//              }

//              const isMatch = await bcrypt.compare(password, user.password);
//              if (!isMatch) {
//                      return res.status(400).json({ success: false, message: "Invalid credentials" });
//              }

//              const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
//                      expiresIn: "1d",
//              });

//              const plans = await Plan.find({ user_id: user._id });
//              const planCount = plans.length || 0;

//              res.status(200).json({
//                      success: true,
//                      message: "User login successful",
//                      token,
//                      user,
//                      userPlanlength: planCount,
//              });
//      } catch (err) {
//              console.error("Login Error:", err);
//              res.status(500).json({ success: false, message: "Server error" });
//      }
// };


// ================== 🔑 LOGIN ==================
exports.login = async (req, res) => {
	try {
		const { email, password } = req.body;
		const normalizedEmail = (email || "").trim().toLowerCase();
		const normalizedAdminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

		// ✅ ADMIN LOGIN (using bcrypt)
		if (normalizedEmail && normalizedEmail === normalizedAdminEmail) {
			let match = false;

			// Prefer plaintext env password if configured (common in local/dev).
			// If ADMIN_PASSWORD_HASH is left from an old password, relying on it would break login.
			if (process.env.ADMIN_PASSWORD) {
				match = password === process.env.ADMIN_PASSWORD;
			} else if (process.env.ADMIN_PASSWORD_HASH) {
				match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
			} else {
				return res.status(500).json({
					success: false,
					message: "Admin credentials are not configured on server"
				});
			}

			if (match) {
				// Ensure we have an admin user in DB (seed runs on startup, but keep a safe fallback here)
				let adminUser = await User.findOne({ email: normalizedAdminEmail });
				if (!adminUser) {
					const hashedPassword = process.env.ADMIN_PASSWORD
						? await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
						: process.env.ADMIN_PASSWORD_HASH;

					let randomCode = generateRandomCode();
					for (let attempt = 0; attempt < 20; attempt++) {
						// eslint-disable-next-line no-await-in-loop
						const exists = await User.exists({ randomCode });
						if (!exists) break;
						randomCode = generateRandomCode();
					}

					adminUser = new User({
						fullName: "Admin",
						email: normalizedAdminEmail,
						password: hashedPassword,
						role: "admin",
						randomCode,
						team: [],
					});
					await adminUser.save();
				}

				const token = jwt.sign(
					{ id: adminUser._id, role: "admin", email: adminUser.email },
					process.env.JWT_SECRET,
					{ expiresIn: "1d" }
				);

				return res.status(200).json({
					success: true,
					message: "Admin login successful",
					user: { _id: adminUser._id, email: adminUser.email, role: "admin" },
					token,
					userPlanlength: 0,
				});
			} else {
				return res.status(400).json({ success: false, message: "Invalid admin credentials" });
			}
		}

		// ✅ Regular user login (bcrypt check)
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}

		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "1d",
		});

		const plans = await Plan.find({ user_id: user._id });
		const planCount = plans.length || 0;

		res.status(200).json({
			success: true,
			message: "User login successful",
			token,
			user,
			userPlanlength: planCount,
		});
	} catch (err) {
		console.error("Login Error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};




// ================== 🧍 GET ALL USERS ==================
exports.getAllUsers = async (req, res) => {
	try {
		const users = await User.find().select("-password"); // exclude password
		res.status(200).json({
			success: true,
			users,
			count: users.length,
		});
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ================== 🗑️ DELETE USER ==================
exports.deleteUser = async (req, res) => {
	try {
		const { userId } = req.body;
		if (!userId) {
			return res.status(400).json({ success: false, message: "User ID required" });
		}

		const deleted = await User.findByIdAndDelete(userId);
		if (!deleted) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		res.status(200).json({ success: true, message: "User deleted successfully" });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ================== 🔁 FORGOT PASSWORD ==================
exports.forgetPassword = async (req, res) => {
	try {
		const { email } = req.body;
		const user = await User.findOne({ email });

		if (!user) return res.status(404).json({ success: false, message: "User not found" });

		const otp = Math.floor(10000 + Math.random() * 90000).toString();
		user.resetOtp = otp;
		user.resetOtpExpire = Date.now() + 5 * 60 * 1000;
		await user.save();

		await transporter.sendMail({
			from: process.env.EMAIL_USER,
			to: email,
			subject: "Password Reset OTP",
			text: `Your OTP for password reset is ${otp}. It will expire in 5 minutes.`,
		});

		res.json({ success: true, message: "OTP sent to email" });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ================== 🔁 RESET PASSWORD ==================
exports.resetPassword = async (req, res) => {
	try {
		const { email, resetcode, password, confirmpassword } = req.body;
		if (password !== confirmpassword)
			return res.status(400).json({ success: false, message: "Passwords do not match" });

		const user = await User.findOne({ email });
		if (!user)
			return res.status(404).json({ success: false, message: "User not found" });

		if (user.resetOtp !== resetcode || user.resetOtpExpire < Date.now())
			return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

		user.password = await bcrypt.hash(password, 10);
		user.resetOtp = undefined;
		user.resetOtpExpire = undefined;
		await user.save();

		res.json({ success: true, message: "Password reset successfully" });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};