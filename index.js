
// require("dotenv").config(); // ✅ Load environment variables first

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const path = require("path");

// // ✅ Import routes
// const authRoutes = require("./routes/user");
// const paymentRoutes = require("./routes/payment");

// const bindRoutes = require("./routes/bindAccountRoutes");
// const teamDetailsRoutes = require("./routes/Teamdetails");
// const planRoutes = require("./routes/plain");
// const commissionRoutes = require('./routes/commissionRoutes');

// const adminRoutes = require("./routes/adminRoutes");
// const announcementRoutes = require("./routes/announcementRoutes");
// const userHistory = require("./routes/userHistory");



// const app = express();


// // ✅ CORS Configuration (Only allow frontend)
// app.use(
// 	cors({
// 		origin: [
// 			"http://localhost:3000",
// 			"https://solarx0.com",
// 			"https://solarfullfrontend.vercel.app",
// 			"https://www.solarx0.com",
// 		],
// 		methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
// 		credentials: true,
// 	})
// );

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ✅ MongoDB Connection
// mongoose
// 	.connect(process.env.MONGO_URI, {
// 		useNewUrlParser: true,
// 		useUnifiedTopology: true,
// 	})
// 	.then(() => console.log("✅ MongoDB Connected"))
// 	.catch((err) => console.error("❌ MongoDB Connection Error:", err));

// // ✅ Static Folder for uploads
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // ✅ API Routes
// app.use("/api", authRoutes);
// app.use("/api", userHistory);

// app.use("/team", teamDetailsRoutes);
// app.use("/api/plans", planRoutes);
// app.use("/api", paymentRoutes);
// app.use("/api/bindAccountRoutes", bindRoutes);
// app.use('/api/commission', commissionRoutes);
// app.use("/api", adminRoutes);
// app.use("/api", announcementRoutes);


// // ✅ Cron Jobs (auto-run tasks)
// require("./cron/planCron");
// require('./utils/commissionCron');
// console.log('Commission distribution cron job started');


// // ✅ Root Test Route
// app.get("/", (req, res) => {
// 	console.log("🌐 Server connected successfully");
// 	res.send("Hello from SolarX0 Backend!");
// });

// // ✅ Test Claim Reward Route
// app.get("/api/test-claim", (req, res) => {
// 	res.json({ message: "Claim reward route is working!" });
// });

// // ✅ Start Server
// const PORT = process.env.PORT || 3005;
// app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));



require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");

const app = express();

/* ======================================================
   ✅ CORS (EXPRESS v5 SAFE)
====================================================== */

const allowedOrigins = [
	"http://localhost:3000",
	"https://solarfullfrontend.vercel.app",
	"https://www.metadrive01.xyz",
	"https://metadrive01.xyz"
];

app.use((req, res, next) => {
	const origin = req.headers.origin;

	if (allowedOrigins.includes(origin)) {
		res.header("Access-Control-Allow-Origin", origin);
	}

	res.header("Access-Control-Allow-Credentials", "true");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization"
	);
	res.header(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, OPTIONS"
	);

	// ✅ Handle preflight safely (NO "*")
	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}

	next();
});

/* ======================================================
   ✅ BODY PARSERS
====================================================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   ✅ MONGODB
====================================================== */

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB Connected"))
	.catch((err) => console.error("❌ MongoDB Error:", err));

/* ======================================================
   ✅ STATIC FILES
====================================================== */

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ======================================================
   ✅ ROUTES
====================================================== */

app.use("/api", require("./routes/user"));
app.use("/api", require("./routes/userHistory"));
app.use("/team", require("./routes/Teamdetails"));
app.use("/api/plans", require("./routes/plain"));
app.use("/api", require("./routes/payment"));
app.use("/api/bindAccountRoutes", require("./routes/bindAccountRoutes"));
app.use("/api/commission", require("./routes/commissionRoutes"));
app.use("/api", require("./routes/adminRoutes"));
app.use("/api", require("./routes/announcementRoutes"));

/* ======================================================
   ✅ TEST ROUTES
====================================================== */

app.get("/", (req, res) => {
	res.send("🚀 SolarX Backend is running");
});

app.get("/api/test", (req, res) => {
	res.json({
		success: true,
		message: "Backend connected successfully ✅",
	});
});

/* ======================================================
   ✅ CRON JOBS
====================================================== */

cron.schedule("*/5 * * * *", () => {
	console.log("⏱️ Plan cron executed");
	require("./cron/planCron");
});

cron.schedule("0 0 * * *", () => {
	console.log("💰 Commission cron executed");
	require("./utils/commissionCron");
});

console.log("✅ Cron jobs scheduled");

/* ======================================================
   ✅ START SERVER
====================================================== */

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
	console.log(`🚀 Server started on port ${PORT}`);
});
