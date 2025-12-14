import mongoose from "mongoose";

const volunteerSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  age: Number,
  location: String,
  skills: String,
  interests: [String],
  availability: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Volunteer", volunteerSchema);
