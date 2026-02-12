import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  username: { type: String, required: true, default: "" },
  pfp_url: { type: String, required: true, default: "https://res.cloudinary.com/dxnbcmh48/image/upload/v1764310213/alfap9qgoadm1ytsyugm.png"},
  roles: { type: [String], required: true, default: [] },
  liked_subject: { type: [String], required: true, default: []},
  recent_viewed: {
    type: [{ 
      subjectId: { type: String, ref: 'Subject', required: true },
      lessonId: { type: String, ref: 'Lesson', required: true },
      viewedAt: { type: Date, required: true },
      subject_title: { type: String, required: true, },
      lesson_title: { type: String, required: true, },
      image_url: { type: String, required: true, default: "https://res.cloudinary.com/dpcig7o5t/image/upload/v1767019358/base_study_o0o20v.png" }, 
    }], 
    default: [], required: true,
  }
})

export const UserModel = mongoose.model('user', userSchema);