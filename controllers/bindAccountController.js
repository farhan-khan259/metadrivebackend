const BindAccount = require("../models/BindAccount");
const User = require("../models/User");

// ✅ Create a new bank account binding
// controllers/bindAccountController.js

exports.createBindAccount = async (req, res) => {
	try {
		console.log("Request body:", req.body);
		const { userId, bankName, AccountNumber, Accountholder } = req.body;

		// ✅ Required fields check
		if (!userId || !bankName || !AccountNumber || !Accountholder) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
			});
		}

		// ✅ Check if account already exists for this user
		const existingAccount = await BindAccount.findOne({ user_id: userId });
		if (existingAccount) {
			return res.status(400).json({
				success: false,
				message: "Account already bound for this user",
			});
		}

		// ✅ Create new account (use consistent schema field names)
		const newAccount = new BindAccount({
			user_id: userId,
			bankName: bankName.trim(),
			AccountNumber: AccountNumber.trim(), // use lowercase field
			Accountholder: Accountholder.trim(), // use lowercase field
		});

		await newAccount.save();

		console.log("✅ New account created:", newAccount);

		return res.status(201).json({
			success: true,
			message: "Account successfully bound",
			data: newAccount,
		});
	} catch (err) {
		console.error("❌ Error creating bind account:", err);
		return res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// ✅ Get all accounts for a specific user
exports.getUserBindAccounts = async (req, res) => {
	console.log("Request body:", req.body);
	try {
		const { userId } = req.body;

		if (!userId) {
			return res.status(400).json({
				success: false,
				message: "User ID is required",
			});
		}

		const accounts = await BindAccount.find({ user_id: userId });
		console.log("Accounts found:", accounts);
		if (accounts.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "No accounts found" });
		}
		const user = await User.findById(userId);

		return res.status(200).json({
			success: true,
			count: accounts.length,
			totalMoneyAccount: user.userbalance,
			data: accounts,
			message: "Accounts found",
		});
	} catch (error) {
		console.error("Error in getUserBindAccounts:", error.message);
		return res.status(500).json({
			success: false,
			message: "Server error while fetching accounts",
		});
	}
};

// ✅ Update account by ID