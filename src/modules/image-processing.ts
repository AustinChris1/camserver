import "../config/face-api";
import * as faceapi from "@vladmandic/face-api";
import { db } from "../config/firebase";
import { child, get, ref, set } from "firebase/database";
import { loadImage } from "canvas";
import { Hono } from "hono";

// Telegram Bot configuration
const BOTtoken = "8157441188:AAEL8YYm7fUbGPKSdmnxQADSj11hTfKAPJg";
const CHAT_ID = "7683328159";

// Firebase Database Reference
const dbRef = ref(db);

// Function to get labels from the database
const getLabels = () =>
  get(child(dbRef, "UsersData/")).then((snapshot) => {
    if (snapshot.exists())
      return Object.values(snapshot.val()).map((_) => (_ as any).name);
    throw new Error("Failed to load labels");
  });

const labels = await getLabels();

// Load face-api models
const loadModels = async () => {
  const modelPath = "https://ruisantosdotme.github.io/face-api.js/weights/";
  try {
    console.log("Loading face-api models...");
    await Promise.all([
      faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
    ]);
    console.log("Models loaded successfully.");
  } catch (error) {
    throw new Error(`Error loading face-api models: ${error}`);
  }
};

await loadModels();

// Function to load labeled images for face recognition
const loadLabeledImages = async () => {
  const descriptions = await Promise.all(
    labels.map(async (label) => {
      const labeledImage = await loadImage(
        `https://firebasestorage.googleapis.com/v0/b/bodycam1001.appspot.com/o/images%2F${label}.jpg?alt=media`,
      );

      if (!labeledImage || labeledImage.width === 0 || labeledImage.height === 0) {
        console.warn(`Invalid image for ${label}`);
        return null;
      }

      const detections = await faceapi
        .detectSingleFace(labeledImage as any)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detections) {
        console.warn(`Failed to create detections for ${label}`);
        return null;
      }
      return new faceapi.LabeledFaceDescriptors(label, [detections.descriptor]);
    }),
  );

  return descriptions.filter((d) => !!d);
};

const labeledFaceDescriptors = await loadLabeledImages();

// Function to send image to Telegram
async function sendToTelegram(photoBuffer: Buffer, label: string): Promise<void> {
  const url = `https://api.telegram.org/bot${BOTtoken}/sendPhoto`;
  const formData = new FormData();

  formData.append("chat_id", CHAT_ID);
  formData.append("caption", `Detected: ${label}`);
  formData.append("photo", new Blob([photoBuffer], { type: "image/jpeg" }), "detected.jpg");

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json() as { ok: boolean; description?: string };
    
    if (!data.ok) {
      throw new Error(`Failed to send photo: ${data.description}`);
    }

    console.log("Photo sent to Telegram successfully.");
  } catch (error) {
    console.error("Error sending photo to Telegram:", error);
  }
}

export const router = new Hono().post("/stream", async (c) => {
  try {
    const { image: base64Image, UID, location } = await c.req.json();

    if (!base64Image) {
      return c.json({ error: "Image data not provided" }, 400);
    }
    
    // Reference to the CameraUIDs section of Firebase
    const camDataRef = ref(db, 'CameraUIDs');

    // Check if the camera entry exists
    const cameraRef = ref(db, `CameraUIDs`); // This points to the CameraUIDs node in Firebase
    const snapshot = await get(cameraRef);

    if (snapshot.exists()) {
      // Check if the camera UID exists in the database
      let cameraIdToUpdate = null;
      Object.keys(snapshot.val()).forEach((cameraId) => {
        if (snapshot.val()[cameraId].uid === UID) {
          cameraIdToUpdate = cameraId; // Camera with matching UID found
        }
      });

      if (cameraIdToUpdate) {
        // Camera exists, update only the location
        await set(ref(db, `CameraUIDs/${cameraIdToUpdate}/location`), location);
        console.log(`Updated location for camera with UID: ${UID}`);
      } else {
        // Camera does not exist, create a new entry
        const camCount = Object.keys(snapshot.val()).length;
        const cameraID = `camera${camCount + 1}`; // e.g., camera1
        await set(ref(db, `CameraUIDs/${cameraID}`), { location, uid: UID });
        console.log(`Stored new camera: ${cameraID} with UID: ${UID} and location: ${location}`);
      }
    } else {
      // CameraUIDs node doesn't exist, so we create the first camera entry
      const cameraID = "camera1"; // Assuming the first camera
      await set(ref(db, `CameraUIDs/${cameraID}`), { location, uid: UID });
      console.log(`Stored new camera: ${cameraID} with UID: ${UID} and location: ${location}`);
    }

    // Decode base64 to buffer
    const imageBuffer = Buffer.from(base64Image, "base64");

    // Load image for face processing
    const image = await loadImage(imageBuffer);
    if (!image || image.width === 0 || image.height === 0) {
      return c.json({ error: "Invalid image size" }, 400);
    }

    // Perform face detection
    const detections = await faceapi
      .detectAllFaces(image as any)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return c.json({ message: "No detections found" }, 400);
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    const results = detections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    for (const result of results) {
      if (result.label !== "unknown") {
        console.log(`Recognized: ${result.label}`);
        if (result.distance < 0.45) {
          console.log("Sending photo to Telegram with label:", result.label);
          await sendToTelegram(imageBuffer, result.label);
        }
        return c.json({ message: "Face recognized" });
      }
    }

    return c.json({ message: "Face not recognized" }, 400);
  } catch (error) {
    console.error("Error processing image:", error);
    return c.json({ error: "Server error" }, 500);
  }
});
