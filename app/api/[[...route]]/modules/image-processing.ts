import "../config/face-api";
import * as faceapi from "@vladmandic/face-api";
import { db } from "../config/firebase";
import { child, get, ref } from "firebase/database";
import { loadImage } from "canvas";
import { Hono } from "hono";

const BOTtoken = "8157441188:AAEL8YYm7fUbGPKSdmnxQADSj11hTfKAPJg";
const CHAT_ID = "7683328159";

const dbRef = ref(db);

const getLabels = () =>
	get(child(dbRef, "UsersData/")).then((snapshot) => {
		if (snapshot.exists())
			return Object.values(snapshot.val()).map((_) => (_ as any).name);
		throw new Error("Failed to load labels");
	});

const labels = await getLabels();

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

const loadLabeledImages = async () => {
	const descriptions = await Promise.all(
		labels.map(async (label) => {
			const labeledImage = await loadImage(
				`https://firebasestorage.googleapis.com/v0/b/bodycam1001.appspot.com/o/images%2F${label}.jpg?alt=media`,
			);

			if (
				!labeledImage ||
				labeledImage.width === 0 ||
				labeledImage.height === 0
			) {
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

async function sendToTelegram(
	photoBuffer: Buffer,
	label: string,
): Promise<void> {
	const url = `https://api.telegram.org/bot${BOTtoken}/sendPhoto`;
	const formData = new FormData();

	formData.append("chat_id", CHAT_ID);
	formData.append("caption", `Detected: ${label}`);
	formData.append(
		"photo",
		new Blob([photoBuffer], { type: "image/jpeg" }),
		"detected.jpg",
	);

	try {
		const response = await fetch(url, {
			method: "POST",
			body: formData,
		});

		const data = (await response.json()) as {
			ok: boolean;
			description?: string;
		};

		if (!data.ok) {
			throw new Error(`Failed to send photo: ${data.description}`);
		}

		console.log("Photo sent to Telegram successfully.");
	} catch (error) {
		console.error("Error sending photo to Telegram:", error);
	}
}

export const router = new Hono().post("/stream", async (c) => {
	const { image: rawImage } = await c.req.parseBody();
	if (!(rawImage instanceof File)) {
		return c.json({ error: "Invalid data" }, 400);
	}

	const imageBuffer = Buffer.from(await rawImage.arrayBuffer());
	const image = await loadImage(imageBuffer);

	if (!image || image.width === 0 || image.height === 0) {
		return c.json({ error: "Invalid image size" }, 400);
	}

	const detections = await faceapi
		.detectAllFaces(image as any)
		.withFaceLandmarks()
		.withFaceDescriptors();

	if (detections.length === 0) {
		return c.json({ message: "No detections found" }, 400);
	}

	const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
	const results = detections.map((d) =>
		faceMatcher.findBestMatch(d.descriptor),
	);

	for (const result of results) {
		if (result.label !== "unknown") {
			console.log(`Recognized: ${result.label}`);
			if (result.distance < 0.4) {
				console.log("Sending photo to Telegram with label:", result.label);
				await sendToTelegram(imageBuffer, result.label);
			}
			return c.json({ message: "Face recognized" });
		}
	}

	return c.json({ message: "Face not recognized" }, 400);
});
