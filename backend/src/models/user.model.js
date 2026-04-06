import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    sparse: true
  },

  password: {
    type: String,
    required: true
  },

  avatar: String,

  status: {
    type: String,
    enum: ["ONLINE", "OFFLINE", "IN_CALL"],
    default: "OFFLINE"
  },

  lastSeenAt: Date

}, { timestamps: true });

export const User = mongoose.model("User", userSchema);