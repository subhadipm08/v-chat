import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ["PUBLIC", "PRIVATE"],
    default: "PRIVATE"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  maxParticipants: {
    type: Number,
    default: 5
  },
  currentParticipants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  status: {
    type: String,
    enum: ["WAITING", "ACTIVE", "ENDED"],
    default: "WAITING",
    index: true
  },
  startedAt: Date,
  endedAt: Date
}, { timestamps: true });

export const Room = mongoose.model("Room", roomSchema);
