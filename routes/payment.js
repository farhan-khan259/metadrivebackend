// // routes/paymentRoutes.js
// const express = require("express");
// const router = express.Router();
// const paymentController = require("../controllers/paymentController");

// // File upload (for deposit screenshots)
// const multer = require("multer");
// const path = require("path");

// // ✅ Configure Multer storage
// const storage = multer.diskStorage({
// 	destination: function (req, file, cb) {
// 		cb(null, "uploads/"); // save in uploads/ folder
// 	},
// 	filename: function (req, file, cb) {
// 		cb(
// 			null,
// 			Date.now() +
// 			"-" +
// 			Math.round(Math.random() * 1e9) +
// 			path.extname(file.originalname)
// 		);
// 	},
// });
// const upload = multer({ storage });

// // ✅ Routes
// router.post(
// 	"/deposit",
// 	upload.single("screenshot"),
// 	paymentController.createDeposit
// );
// router.post("/withdrawal", paymentController.createWithdrawal);

// router.get("/payments", paymentController.getPayments);
// router.post("/status", paymentController.updatePaymentStatus);
// router.get("/:id", paymentController.getPaymentById);

// router.get("/status", paymentController.updatePaymentStatus);

// router.delete("/:id", paymentController.deletePayment);

// module.exports = router;




const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// File upload (for deposit screenshots)
const multer = require("multer");
const path = require("path");

// ✅ Configure Multer storage
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "uploads/"); // save in uploads/ folder
	},
	filename: function (req, file, cb) {
		cb(
			null,
			Date.now() +
			"-" +
			Math.round(Math.random() * 1e9) +
			path.extname(file.originalname)
		);
	},
});
const upload = multer({ storage });

// ✅ Routes
router.post(
	"/deposit",
	upload.single("screenshot"),
	paymentController.createDeposit
);
router.post("/withdrawal", paymentController.createWithdrawal);

router.get("/payments", paymentController.getPayments);
router.post("/status", paymentController.updatePaymentStatus);
router.get("/:id", paymentController.getPaymentById);
router.delete("/:id", paymentController.deletePayment);

module.exports = router;