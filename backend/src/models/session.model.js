import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },

  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    index: true
  },

  connectionId: {
    type: String // socket.id
  },

  joinedAt: {
    type: Date,
    required: true
  },

  leftAt: Date,

  duration: Number, // milliseconds

  exitReason: {
    type: String,
    enum: ["LEFT", "DISCONNECTED", "KICKED", "ERROR"]
  }

}, { timestamps: true });

export const Session = mongoose.model("Session", sessionSchema);