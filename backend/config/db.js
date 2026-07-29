const mongoose = require("mongoose");

async function connectDatabase(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

module.exports = { connectDatabase };
