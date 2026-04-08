import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  status: {
    type: String,
    enum: ["ACTIVE", "ENDED"],
    default: "ACTIVE"
  }
}, { timestamps: true });

matchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const Match = mongoose.model("Match", matchSchema);
