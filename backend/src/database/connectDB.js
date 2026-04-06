import mongoose from "mongoose";

const connectDB = () => {
    if (!process.env.MONGO_URL) {
        return Promise.reject(new Error("MONGO_URL not defined"));
    }

    return mongoose.connect(process.env.MONGO_URL)
        .then(() => {
            console.log("[DB CONNECTED SUCCESSFULLY...]");
        });
};

export default connectDB;