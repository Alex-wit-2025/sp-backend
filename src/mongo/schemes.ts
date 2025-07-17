//data schemas for mongodb
import mongoose, { Schema, Document } from "mongoose";

export interface IPhotoLink extends Document {
  iid: number; //image id
  uid: number; // user id
  key: string; // minio key
  bucket: string; //minio bucket
}

const PhotoLinkSchema = new Schema<IPhotoLink>({
  uid: { type: Number, required: true },
  key: { type: String, required: true },
  bucket: { type: String, require: true },
  iid: { type: Number, required: true, unique: true },
});

export const PhotoLink = mongoose.model<IPhotoLink>(
  "PhotoLink",
  PhotoLinkSchema,
);
