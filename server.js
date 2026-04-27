const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("MongoDB Connected"));

const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model("Product", productSchema, "Products");

app.get("/", (req,res)=>{
  res.send("GiftCraft Backend Running");
});

app.get("/products", async (req,res)=>{
  const data = await Product.find();
  res.json(data);
});

app.get("/chat", (req,res)=>{
  res.send("Chatbot route is working. Use POST request.");
});

// app.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const products = await Product.find().limit(20);

//     const productList = products
//       .map(p => `${p.name} - ₹${p.price}`)
//       .join(", ");

//     const response = await fetch(
//       `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//           contents: [
//             {
//               parts: [
//                 {
//                   text: `You are a gift shopping assistant. Recommend from this list: ${productList}. User query: ${message}`
//                 }
//               ]
//             }
//           ]
//         })
//       }
//     );

//     const data = await response.json();
//     console.log(data);

//     // const reply =
//     //   data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

//     const reply =
//     data?.candidates?.[0]?.content?.parts?.[0]?.text ||
//     data?.error?.message ||
//     "No response";

//     res.json({ reply, products });

//   } catch (error) {
//     res.status(500).json({ reply: "Error", products: [] });
//   }
// });

// app.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const products = await Product.find().limit(20);

//     const productList = products
//       .map(p => `${p.name} - ₹${p.price}`)
//       .join(", ");

//     const response = await fetch("https://api.cohere.ai/v1/chat", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${process.env.COHERE_API_KEY}`
//       },
//       body: JSON.stringify({
//         model: "command-r",
//         message: `You are a smart gift shopping assistant.
// Available products: ${productList}
// User query: ${message}
// Recommend best products.`
//       })
//     });

//     const data = await response.json();

//     // console.log(data);
//     console.log(JSON.stringify(data, null, 2));

//     const reply = data.text || "No response";

//     res.json({
//       reply,
//       products
//     });

//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       reply: "Something went wrong",
//       products: []
//     });
//   }
// });

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Get products from MongoDB
    // const products = await Product.find().limit(20);
    // const products = [
    //   { name: "Teddy Bear", price: 499 },
    //   { name: "Smart Watch", price: 1999 },
    //   { name: "Coffee Mug", price: 299 },
    //   { name: "Perfume Gift Set", price: 1499 },
    //   { name: "Photo Frame", price: 599 }
    // ];
    // const userText = message.toLowerCase();

    // let budget = null;

    // const match = userText.match(/under\s+(\d+)/);
    // if (match) {
    //   budget = Number(match[1]);
    // }

    // let query = {};

    // if (budget) {
    //   query.price = { $lte: budget };
    // }

    // const products = await Product.find(query).limit(20);

    const userText = message.toLowerCase();
    let query = {};

    // Budget detection
    const budgetMatch = userText.match(/under\s+(\d+)/);
    if (budgetMatch) {
      query.price = { $lte: Number(budgetMatch[1]) };
    }

    // Occasion detection
    if (userText.includes("birthday")) {
      query.occasion = "Birthday";
    }
    else if (userText.includes("anniversary")) {
      query.occasion = "Anniversary";
    }
    else if (userText.includes("valentine")) {
      query.occasion = "Valentine";
    }

    // Gender / recipient detection
    if (
      userText.includes("sister") ||
      userText.includes("mother") ||
      userText.includes("mom") ||
      userText.includes("wife") ||
      userText.includes("girlfriend")
    ) {
      query.gender = { $in: ["Female", "All"] };
    }

    if (
      userText.includes("brother") ||
      userText.includes("father") ||
      userText.includes("dad") ||
      userText.includes("husband") ||
      userText.includes("boyfriend")
    ) {
      query.gender = { $in: ["Male", "All"] };
    }

    const products = await Product.find(query).limit(20);
    
    if (products.length === 0) {
      return res.json({
        reply: "Sorry, no matching gifts found. Try increasing budget.",
        products: []
      });
    }

    const productList = products
      .map((p) => `${p.name} - ₹${p.price}`)
      .join(", ");

    // Cohere API Call
    const response = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        messages: [
          {
            role: "user",
            content: `You are an intelligent gift shopping assistant.

Available products:
${productList}

User query:
${message}

Only recommend from the listed products.
Respect the user's budget and preferences.
Be concise and helpful.`
          }
        ]
      })
    });

    const data = await response.json();

    console.log(data);

    const reply =
      data?.message?.content?.[0]?.text ||
      data?.text ||
      "No response";

    res.json({
      reply,
      products
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: "Something went wrong",
      products: []
    });
  }
});

app.post("/recommend", async (req, res) => {
  try {
    const { budget, occasion, recipient, category } = req.body;

    let query = {};

    if (budget) {
      query.price = { $lte: Number(budget) };
    }

    if (occasion && occasion !== "Any") {
      query.occasion = occasion;
    }

    if (category && category !== "Any") {
      query.category = category;
    }

    if (recipient) {
      const text = recipient.toLowerCase();

      if (
        ["sister", "mother", "mom", "wife", "girlfriend"].includes(text)
      ) {
        query.gender = { $in: ["Female", "All"] };
      }

      if (
        ["brother", "father", "dad", "husband", "boyfriend"].includes(text)
      ) {
        query.gender = { $in: ["Male", "All"] };
      }
    }

    const products = await Product.find(query)
      .sort({ price: 1 })
      .limit(12);

    res.json(products);

  } catch (error) {
    console.log(error);
    res.status(500).json([]);
  }
});

app.get("/test", (req,res)=>{
  res.send("TEST ROUTE WORKING");
});

app.get("/also-like/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const selected = await Product.findById(productId);

    if (!selected) {
      return res.status(404).json([]);
    }

    const minPrice = selected.price - 300;
    const maxPrice = selected.price + 300;

    let recommendations = await Product.find({
      _id: { $ne: selected._id },
      category: selected.category,
      gender: selected.gender,
      occasion: selected.occasion,
      price: { $gte: minPrice, $lte: maxPrice }
    }).limit(4);

    // Fallback if too few results
    if (recommendations.length < 4) {
      recommendations = await Product.find({
        _id: { $ne: selected._id },
        category: selected.category
      }).limit(4);
    }

    res.json(recommendations);

  } catch (error) {
    console.log(error);
    res.status(500).json([]);
  }
});

app.post("/feed", async (req, res) => {
  try {
    const {
      budget,
      occasion,
      recipient,
      category,
      recentSearch,
      lastViewedId
    } = req.body;

    let query = {};

    // Budget
    if (budget) {
      query.price = { $lte: Number(budget) };
    }

    // Occasion
    if (occasion && occasion !== "Any") {
      query.occasion = occasion;
    }

    // Category
    if (category && category !== "Any") {
      query.category = category;
    }

    // Recipient
    if (
      ["sister","mother","mom","wife","girlfriend"].includes(
        recipient?.toLowerCase()
      )
    ) {
      query.gender = { $in: ["Female", "All"] };
    }

    if (
      ["brother","father","dad","husband","boyfriend"].includes(
        recipient?.toLowerCase()
      )
    ) {
      query.gender = { $in: ["Male", "All"] };
    }

    // Base personalized results
    let products = await Product.find(query).limit(8);

    // Recent Search Boost
    if (recentSearch) {
      const text = recentSearch.toLowerCase();

      if (text.includes("birthday")) {
        query.occasion = "Birthday";
      }

      if (text.includes("anniversary")) {
        query.occasion = "Anniversary";
      }
    }

    // Last Viewed Product Similarity
    let alsoLike = [];

    if (lastViewedId) {
      const viewed = await Product.findById(lastViewedId);

      if (viewed) {
        alsoLike = await Product.find({
          _id: { $ne: viewed._id },
          category: viewed.category
        }).limit(4);
      }
    }

    res.json({
      recommendedForYou: products,
      becauseYouViewed: alsoLike
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({});
  }
});

app.listen(5000, ()=>{
  console.log("Server running on port 5000");
});