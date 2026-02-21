// const Payment = require("../models/payment");
// const User = require("../models/User");

// // ✅ Create Deposit
// exports.createDeposit = async (req, res) => {
// 	try {
// 		const { user_id, amount, payment_method } = req.body;
// 		if (!user_id || !amount || !payment_method) {
// 			return res.status(400).json({
// 				success: false,
// 				message: "All fields are required",
// 			});
// 		}

// 		const screenshot = req.file ? req.file.path : null;

// 		const payment = new Payment({
// 			user_id,
// 			depositsAmount: Number(amount),
// 			screenshot,
// 			payment_method,
// 			depositStatus: "pending",
// 		});

// 		await payment.save();

// 		res.status(201).json({
// 			success: true,
// 			message: "Deposit request created successfully",
// 			data: payment,
// 		});
// 	} catch (error) {
// 		console.error("Deposit error:", error);
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

// // ✅ Create Withdrawal
// exports.createWithdrawal = async (req, res) => {
// 	try {
// 		const { userId, withdrawals, bankName, accountNumber, accountName } = req.body;
// 		const user = await User.findById(userId);

// 		if (!user) {
// 			return res.status(404).json({
// 				success: false,
// 				message: "User not found",
// 			});
// 		}

// 		if (user.userbalance < withdrawals) {
// 			return res.status(400).json({
// 				success: false,
// 				message: "Insufficient balance",
// 			});
// 		}

// 		// ✅ DEDUCT FROM BALANCE IMMEDIATELY
// 		user.userbalance -= withdrawals;
// 		await user.save();

// 		const payment = new Payment({
// 			user_id: userId,
// 			withdrawalsAmount: Number(withdrawals),
// 			withdrawalStatus: "pending",
// 			payment_method: bankName,
// 			accountNumber,
// 			accountHolderName: accountName,
// 		});

// 		await payment.save();

// 		res.status(201).json({
// 			success: true,
// 			message: "Withdrawal request created successfully (pending approval)",
// 			data: payment,
// 			newBalance: user.userbalance,
// 		});
// 	} catch (error) {
// 		console.error("Withdrawal creation error:", error);
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

// // ✅ Get All Payments
// exports.getPayments = async (req, res) => {
// 	try {
// 		const payments = await Payment.find()
// 			.populate("user_id", "email fullName randomCode");
// 		res.status(200).json({ success: true, data: payments });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

// // ✅ Get Payment By ID
// exports.getPaymentById = async (req, res) => {
// 	try {
// 		const payment = await Payment.findById(req.params.id).populate("user_id", "email fullName");
// 		if (!payment) {
// 			return res.status(404).json({ success: false, message: "Payment not found" });
// 		}
// 		res.status(200).json({ success: true, data: payment });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

// // ✅ Update Payment Status (Admin)
// exports.updatePaymentStatus = async (req, res) => {
// 	const { type, status, userId, requesId } = req.body;

// 	try {
// 		const user = await User.findById(userId);
// 		const payment = await Payment.findOne({ user_id: userId, _id: requesId });

// 		if (!user) return res.status(404).json({ success: false, message: "User not found" });
// 		if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

// 		// ✅ Handle REJECT case (refund balance if withdrawal)
// 		if (status === "reject") {
// 			if (type === "deposit") {
// 				payment.depositStatus = "rejected";
// 			} else if (type === "withdrawal") {
// 				payment.withdrawalStatus = "rejected";

// 				// Refund withdrawal amount to user
// 				const refundAmount = Number(payment.withdrawalsAmount) || 0;
// 				user.userbalance = (user.userbalance || 0) + refundAmount;
// 				await user.save();
// 			}

// 			await payment.save();
// 			return res.status(200).json({
// 				success: true,
// 				message: `${type} request rejected successfully`,
// 				payment,
// 				newBalance: user.userbalance,
// 			});
// 		}

// 		// ✅ Handle APPROVED / PENDING statuses
// 		if (type === "deposit") {
// 			payment.depositStatus = status;

// 			if (status === "approved") {
// 				const depositAmount = Number(payment.depositsAmount) || 0;
// 				user.userbalance = (user.userbalance || 0) + depositAmount;
// 				user.userTotalDeposits = (user.userTotalDeposits || 0) + depositAmount;

// 				await user.save();
// 			}
// 		} else if (type === "withdrawal") {
// 			payment.withdrawalStatus = status;

// 			if (status === "approved") {
// 				// Do not re-deduct balance since it was already deducted on creation
// 				user.userTotalWithdrawals =
// 					(user.userTotalWithdrawals || 0) + Number(payment.withdrawalsAmount);
// 				await user.save();
// 			}
// 		}

// 		await payment.save();

// 		return res.status(200).json({
// 			success: true,
// 			message: `${type} status updated successfully`,
// 			payment,
// 			newBalance: user.userbalance,
// 		});
// 	} catch (error) {
// 		console.error("Update Payment Status Error:", error);
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

// // ✅ Delete Payment
// exports.deletePayment = async (req, res) => {
// 	try {
// 		const payment = await Payment.findByIdAndDelete(req.params.id);
// 		if (!payment) {
// 			return res.status(404).json({ success: false, message: "Payment not found" });
// 		}
// 		res.status(200).json({ success: true, message: "Payment deleted" });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: error.message });
// 	}
// };

const Payment = require("../models/payment");
const User = require("../models/User");

// ✅ Create Withdrawal (UPDATED with fee calculation)
exports.createWithdrawal = async (req, res) => {
	try {
		const {
			userId,
			withdrawals,
			netWithdrawal,
			withdrawalFee,
			bankName,
			accountNumber,
			accountName
		} = req.body;

		console.log("Withdrawal request received:", {
			userId,
			withdrawals,
			netWithdrawal,
			withdrawalFee,
			bankName,
			accountNumber,
			accountName
		});

		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		if (user.userbalance < withdrawals) {
			return res.status(400).json({
				success: false,
				message: "Insufficient balance",
			});
		}

		// ✅ DEDUCT FROM BALANCE IMMEDIATELY (deduct full requested amount)
		user.userbalance -= Number(withdrawals);
		await user.save();

		const payment = new Payment({
			user_id: userId,
			withdrawalsAmount: Number(withdrawals),     // Original requested amount (500)
			netWithdrawal: Number(netWithdrawal),      // Amount after fee (485)
			withdrawalFee: Number(withdrawalFee),      // Fee amount (15)
			withdrawalStatus: "pending",
			payment_method: bankName,
			bankName: bankName,
			accountNumber: accountNumber,
			accountHolderName: accountName,
		});

		await payment.save();

		res.status(201).json({
			success: true,
			message: "Withdrawal request created successfully (pending approval)",
			data: payment,
			newBalance: user.userbalance,
		});
	} catch (error) {
		console.error("Withdrawal creation error:", error);
		res.status(500).json({ success: false, message: error.message });
	}
};

// ✅ Update Payment Status (Admin) - UPDATED
exports.updatePaymentStatus = async (req, res) => {
	const { type, status, userId, requesId } = req.body;

	try {
		const user = await User.findById(userId);
		const payment = await Payment.findOne({ user_id: userId, _id: requesId });

		if (!user) return res.status(404).json({ success: false, message: "User not found" });
		if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

		// ✅ Handle REJECT case (refund balance if withdrawal)
		if (status === "reject") {
			if (type === "deposit") {
				payment.depositStatus = "rejected";
			} else if (type === "withdrawal") {
				payment.withdrawalStatus = "rejected";

				// Refund withdrawal amount to user (full requested amount)
				const refundAmount = Number(payment.withdrawalsAmount) || 0;
				user.userbalance = (user.userbalance || 0) + refundAmount;
				await user.save();
			}

			await payment.save();
			return res.status(200).json({
				success: true,
				message: `${type} request rejected successfully`,
				payment,
				newBalance: user.userbalance,
			});
		}

		// ✅ Handle APPROVED status
		if (status === "approved") {
			if (type === "deposit") {
				payment.depositStatus = "approved";
				const depositAmount = Number(payment.depositsAmount) || 0;
				user.userbalance = (user.userbalance || 0) + depositAmount;
				user.userTotalDeposits = (user.userTotalDeposits || 0) + depositAmount;
			} else if (type === "withdrawal") {
				payment.withdrawalStatus = "approved";
				// For approved withdrawals, we keep the fee deducted
				// The net amount is what user actually receives
				const withdrawalAmount = Number(payment.withdrawalsAmount) || 0;
				user.userTotalWithdrawals = (user.userTotalWithdrawals || 0) + withdrawalAmount;
				// Note: Balance was already deducted when withdrawal was created
				// The fee (withdrawalAmount - netWithdrawal) is kept by the system
			}

			await user.save();
		}

		await payment.save();

		return res.status(200).json({
			success: true,
			message: `${type} status updated to ${status} successfully`,
			payment,
			newBalance: user.userbalance,
		});
	} catch (error) {
		console.error("Update Payment Status Error:", error);
		res.status(500).json({ success: false, message: error.message });
	}
};

// ✅ Get All Payments (UPDATED to include new fields)
exports.getPayments = async (req, res) => {
	try {
		const payments = await Payment.find()
			.populate("user_id", "email fullName randomCode")
			.sort({ createdAt: -1 }); // Sort by latest first

		res.status(200).json({ success: true, data: payments });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// ✅ Create Deposit
exports.createDeposit = async (req, res) => {
	try {
		const { user_id, amount, payment_method } = req.body;
		if (!user_id || !amount || !payment_method) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
			});
		}

		const screenshot = req.file ? req.file.path : null;

		const payment = new Payment({
			user_id,
			depositsAmount: Number(amount),
			screenshot,
			payment_method,
			depositStatus: "pending",
		});

		await payment.save();

		res.status(201).json({
			success: true,
			message: "Deposit request created successfully",
			data: payment,
		});
	} catch (error) {
		console.error("Deposit error:", error);
		res.status(500).json({ success: false, message: error.message });
	}
};

// ✅ Get Payment By ID
exports.getPaymentById = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id).populate("user_id", "email fullName");
		if (!payment) {
			return res.status(404).json({ success: false, message: "Payment not found" });
		}
		res.status(200).json({ success: true, data: payment });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// ✅ Delete Payment
exports.deletePayment = async (req, res) => {
	try {
		const payment = await Payment.findByIdAndDelete(req.params.id);
		if (!payment) {
			return res.status(404).json({ success: false, message: "Payment not found" });
		}
		res.status(200).json({ success: true, message: "Payment deleted" });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};