// skinnedPlayer.js - NPC entity with Minecraft skin, AI behaviors, and walk animation
import { Entity } from "./entity.js"
import { shapes } from "./shapes.js"
import { Matrix } from "./3Dutils.js"
import { state } from "./state.js"

const { sin, cos, sqrt, atan2, PI, random, floor } = Math

// ─── Default Skin Generator ──────────────────────────────────────────────────
// Generates a 256×256 RGBA pixel array with a 64×64 Minecraft default skin
// in the top-left corner. UVs from shapes.player divide by 256 so this maps
// directly. This is used as a fallback when no custom skin is provided.
// expression: "neutral" | "happy" | "surprised" | "sad" | "angry"

const generateDefaultSkin = (expression = "neutral") => {
	const pixels = new Uint8Array(256 * 256 * 4)

	const W = 256 // atlas width
	const set = (x, y, r, g, b, a = 255) => {
		if (x < 0 || x >= 256 || y < 0 || y >= 256) return
		const o = (y * W + x) * 4
		pixels[o] = r; pixels[o+1] = g; pixels[o+2] = b; pixels[o+3] = a
	}
	const rect = (sx, sy, w, h, r, g, b, a = 255) => {
		for (let y = sy; y < sy + h; y++)
			for (let x = sx; x < sx + w; x++) set(x, y, r, g, b, a)
	}

	// Colors - HIGH CONTRAST for visibility
	const SKIN     = [240, 200, 180]  // Skin tone
	const SKIN_D   = [220, 180, 160] // Darker skin (shadows)
	const BLACK    = [0, 0, 0]       // Pure black for contrast
	const BROWN    = [100, 60, 40]   // Hair color (brighter)
	const BROWN_D  = [70, 40, 25]    // Darker hair
	const EYE_WHITE = [255, 255, 255] // Pure white
	const EYE_BLUE  = [50, 100, 255]  // Bright blue eyes
	const EYE_PUPIL = [0, 0, 0]       // Black pupil
	const NOSE     = [180, 140, 120] // Nose shadow (darker)
	const MOUTH    = [200, 80, 80]   // Bright red mouth
	const MOUTH_D  = [150, 50, 50]   // Darker mouth
	const RED_TSHIRT = [200, 50, 50]  // Red t-shirt color
	const RED_TSHIRT_D = [160, 40, 40] // Darker red for shadows
	const WHITE    = [240, 240, 235]
	const GREY     = [200, 200, 195]
	const DGREY    = [60, 60, 65]

	// All coordinates are in 64x64 space, multiply by 4 for 256x256 texture
	// ── HEAD (inner layer) ──
	// Top (8,0) 8×8 — skin base (hair will be in overlay)
	rect(8*4, 0*4, 8*4, 8*4, ...SKIN)
	// Ears stay black for now (will be covered by hair overlay)

	// Bottom (16,0) 8×8 — skin chin
	rect(16*4, 0*4, 8*4, 8*4, ...SKIN)

	// Right side (0,8) 8×8 — skin base (hair will be in overlay)
	rect(0*4, 8*4, 8*4, 8*4, ...SKIN)

	// Front face - CORRECT COORDINATES
	// Direction 3 (Front/South): Head inner is [4,32,4,8,8,32,32] - tx=32, ty=32
	// Direction 2 (Back/North): Head inner is [12,32,12,8,8,96,32] - tx=96, ty=32
	// The front face should be at (32, 32) - let's use the correct coordinates
	const FACE_X = 32  // Front face inner layer
	const FACE_Y = 32  // ty from shapes.js
	const FACE_W = 8   // width
	const FACE_H = 8   // height
	
	// Base skin for entire 8x8 face
	rect(FACE_X, FACE_Y, FACE_W, FACE_H, ...SKIN)
	
	// Eyebrows (top row, pixels 1-2 and 5-6)
	rect(FACE_X + 1, FACE_Y + 1, 2, 1, ...BROWN)   // left eyebrow
	rect(FACE_X + 5, FACE_Y + 1, 2, 1, ...BROWN)   // right eyebrow
	
	// Eyes (row 2-3, columns 1-3 and 5-7)
	rect(FACE_X + 1, FACE_Y + 2, 3, 3, ...EYE_WHITE)   // left eye white
	rect(FACE_X + 2, FACE_Y + 3, 1, 1, ...EYE_BLUE)    // left iris
	set(FACE_X + 2, FACE_Y + 3, ...EYE_PUPIL)          // left pupil
	
	rect(FACE_X + 5, FACE_Y + 2, 3, 3, ...EYE_WHITE)   // right eye white
	rect(FACE_X + 6, FACE_Y + 3, 1, 1, ...EYE_BLUE)    // right iris
	set(FACE_X + 6, FACE_Y + 3, ...EYE_PUPIL)          // right pupil
	
	// Expression adjustments
	if (expression === "surprised") {
		rect(FACE_X + 1, FACE_Y + 2, 3, 4, ...EYE_WHITE)   // bigger eyes
		rect(FACE_X + 5, FACE_Y + 2, 3, 4, ...EYE_WHITE)
		rect(FACE_X + 2, FACE_Y + 3, 1, 2, ...EYE_BLUE)
		rect(FACE_X + 6, FACE_Y + 3, 1, 2, ...EYE_BLUE)
	} else if (expression === "angry") {
		rect(FACE_X + 1, FACE_Y + 2, 3, 2, ...EYE_WHITE)   // smaller eyes
		rect(FACE_X + 5, FACE_Y + 2, 3, 2, ...EYE_WHITE)
		rect(FACE_X + 1, FACE_Y + 1, 2, 1, ...BROWN_D)     // lowered eyebrows
		rect(FACE_X + 5, FACE_Y + 1, 2, 1, ...BROWN_D)
	} else if (expression === "sad") {
		rect(FACE_X + 1, FACE_Y + 3, 3, 2, ...EYE_WHITE)   // lower eyes
		rect(FACE_X + 5, FACE_Y + 3, 3, 2, ...EYE_WHITE)
		rect(FACE_X + 2, FACE_Y + 4, 1, 1, ...EYE_BLUE)
		rect(FACE_X + 6, FACE_Y + 4, 1, 1, ...EYE_BLUE)
	} else if (expression === "happy") {
		rect(FACE_X + 1, FACE_Y + 2, 3, 2, ...EYE_WHITE)   // squinted
		rect(FACE_X + 5, FACE_Y + 2, 3, 2, ...EYE_WHITE)
		rect(FACE_X + 2, FACE_Y + 2, 1, 1, ...EYE_BLUE)
		rect(FACE_X + 6, FACE_Y + 2, 1, 1, ...EYE_BLUE)
	}
	
	// Nose (center column, rows 3-5)
	rect(FACE_X + 3, FACE_Y + 3, 2, 3, ...NOSE)
	
	// Mouth (rows 5-6)
	if (expression === "happy") {
		rect(FACE_X + 2, FACE_Y + 5, 4, 2, ...MOUTH)    // smile
		set(FACE_X + 2, FACE_Y + 5, ...MOUTH_D)         // left corner
		set(FACE_X + 5, FACE_Y + 5, ...MOUTH_D)         // right corner
	} else if (expression === "sad") {
		rect(FACE_X + 2, FACE_Y + 6, 4, 2, ...MOUTH)    // frown
		set(FACE_X + 2, FACE_Y + 7, ...MOUTH_D)
		set(FACE_X + 5, FACE_Y + 7, ...MOUTH_D)
	} else if (expression === "surprised") {
		rect(FACE_X + 3, FACE_Y + 5, 2, 3, ...MOUTH_D)  // open mouth
		rect(FACE_X + 3, FACE_Y + 6, 2, 1, ...MOUTH)
	} else if (expression === "angry") {
		rect(FACE_X + 2, FACE_Y + 6, 4, 2, ...MOUTH_D)
	} else {
		rect(FACE_X + 2, FACE_Y + 6, 4, 2, ...MOUTH)    // neutral
	}

	// Left side (16,8) 8×8
	rect(16*4, 8*4, 8*4, 8*4, ...SKIN)
	rect(22*4, 8*4, 2*4, 3*4, ...BLACK) // ear edge

	// Back face - correct coordinates
	rect(96, 32, 8, 8, ...SKIN)  // Back face at (96, 32) - no features, no black squares

	// ── HEAD OVERLAY (hair) ──
	// Hair coordinates from shapes.js overlay layer
	// Top overlay: tx=160, ty=0 (from shapes.js line 276)
	rect(160, 0, 8, 8, ...BROWN, 255)  // Top of head - full brown hair
	rect(160, 0, 2, 3, ...BROWN_D, 255)   // left hair detail
	rect(166, 0, 2, 3, ...BROWN_D, 255)   // right hair detail
	
	// Bottom overlay: tx=192, ty=0
	rect(192, 0, 8, 8, ...BROWN, 255)  // Bottom of head
	
	// Front overlay: tx=160, ty=32 - ONLY bangs, leave face visible
	rect(160, 32, 8, 1, ...BROWN, 255)      // hair bangs (only top row)
	rect(160, 32, 2, 1, ...BROWN_D, 255)   // left side hair
	rect(166, 32, 2, 1, ...BROWN_D, 255)   // right side hair
	
	// Left overlay: tx=128, ty=32
	rect(128, 32, 8, 8, ...BROWN, 255)  // Left side hair
	rect(128, 32, 2, 3, ...BROWN_D, 255)   // hair edge
	
	// Right overlay: tx=192, ty=32 - THIS IS THE RIGHT SIDE
	rect(192, 32, 8, 8, ...BROWN, 255)  // Right side hair - full coverage
	rect(198, 32, 2, 3, ...BROWN_D, 255)   // hair edge
	
	// Back overlay: tx=224, ty=32
	rect(224, 32, 8, 8, ...BROWN, 255)  // Back hair
	rect(224, 32, 2, 3, ...BROWN_D, 255)   // left back hair
	rect(230, 32, 2, 3, ...BROWN_D, 255)   // right back hair

	// ── BODY (inner layer) — RED T-SHIRT ──
	// Coordinates from shapes.js: Front tx=80, ty=80, Back tx=128, ty=80
	// Top (20,16) 8×4 — red t-shirt
	rect(20*4, 16*4, 8*4, 4*4, ...RED_TSHIRT)
	// Bottom (28,16) 8×4 — red t-shirt
	rect(28*4, 16*4, 8*4, 4*4, ...RED_TSHIRT)
	// Right (16,20) 4×12 — red t-shirt
	rect(16*4, 20*4, 4*4, 12*4, ...RED_TSHIRT)
	// Front (20,20) 8×12 — red t-shirt with darker shadow
	rect(20*4, 20*4, 8*4, 12*4, ...RED_TSHIRT)
	rect(22*4, 22*4, 4*4, 6*4, ...RED_TSHIRT_D)  // darker shadow
	// Left (28,20) 4×12 — red t-shirt
	rect(28*4, 20*4, 4*4, 12*4, ...RED_TSHIRT)
	// Back (32,20) 8×12 — red t-shirt with darker shadow
	rect(32*4, 20*4, 8*4, 12*4, ...RED_TSHIRT)
	rect(34*4, 22*4, 4*4, 6*4, ...RED_TSHIRT_D)  // darker shadow

	// ── RIGHT ARM (40,16) — black ──
	rect(44*4, 16*4, 4*4, 4*4, ...BLACK) // top
	rect(48*4, 16*4, 4*4, 4*4, ...BLACK) // bottom
	rect(40*4, 20*4, 4*4, 12*4, ...BLACK) // outer
	rect(44*4, 20*4, 4*4, 12*4, ...BLACK) // front
	rect(48*4, 20*4, 4*4, 12*4, ...BLACK) // inner
	rect(52*4, 20*4, 4*4, 12*4, ...BLACK) // back

	// ── RIGHT LEG (0,16) — black ──
	rect(4*4, 16*4, 4*4, 4*4, ...BLACK)  // top
	rect(8*4, 16*4, 4*4, 4*4, ...BLACK)  // bottom
	rect(0*4, 20*4, 4*4, 12*4, ...BLACK) // outer
	rect(4*4, 20*4, 4*4, 12*4, ...BLACK) // front
	rect(8*4, 20*4, 4*4, 12*4, ...BLACK) // inner
	rect(12*4, 20*4, 4*4, 12*4, ...BLACK) // back

	// ── LEFT ARM (32,48) — black ──
	rect(36*4, 48*4, 4*4, 4*4, ...BLACK) // top
	rect(40*4, 48*4, 4*4, 4*4, ...BLACK) // bottom
	rect(32*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(36*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(40*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(44*4, 52*4, 4*4, 12*4, ...BLACK)

	// ── LEFT LEG (16,48) — black ──
	rect(20*4, 48*4, 4*4, 4*4, ...BLACK) // top
	rect(24*4, 48*4, 4*4, 4*4, ...BLACK) // bottom
	rect(16*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(20*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(24*4, 52*4, 4*4, 12*4, ...BLACK)
	rect(28*4, 52*4, 4*4, 12*4, ...BLACK)

	return pixels
}

// ─── Skin Texture Helpers ───────────────────────────────────────────────────

const createSkinTexture = (gl, pixels256) => {
	const texture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, texture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels256)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.bindTexture(gl.TEXTURE_2D, null)
	return texture
}

const loadSkinFromImage = (gl, image) => {
	const canvas = document.createElement("canvas")
	canvas.width = 256; canvas.height = 256
	const ctx = canvas.getContext("2d")
	ctx.imageSmoothingEnabled = false
	// Scale 64x64 image to fill 256x256 canvas (4x upscale)
	ctx.drawImage(image, 0, 0, 256, 256)
	const imageData = ctx.getImageData(0, 0, 256, 256)
	return createSkinTexture(gl, new Uint8Array(imageData.data.buffer))
}

const loadSkinFromUrl = (gl, url) => {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = "anonymous"
		img.onload = () => resolve(loadSkinFromImage(gl, img))
		img.onerror = (e) => reject(e)
		img.src = url
	})
}

// ─── Limb Geometry Builder ──────────────────────────────────────────────────
// Extracts vertex/UV data from shapes.player, reorganized by body part so
// each part can be drawn as a contiguous range with its own transform.
//
// Body part → face indices per direction:
//   Head:      0, 1    (inner + overlay)
//   Body:      2, 3
//   Left Arm:  4, 5
//   Right Arm: 6, 7
//   Left Leg:  8, 9
//   Right Leg: 10, 11

const BODY_PARTS = [
	{ name: "head",     indices: [0, 1],   pivot: [0, 1.0, 0] },  // inner=0, overlay=1
	{ name: "body",     indices: [2, 3],   pivot: null },         // inner=2, overlay=3
	{ name: "leftArm",  indices: [4, 5],   pivot: [-0.375, 1.0, 0] },
	{ name: "rightArm", indices: [6, 7],   pivot: [0.375, 1.0, 0] },
	{ name: "leftLeg",  indices: [8, 9],   pivot: [-0.125, 0.25, 0] },
	{ name: "rightLeg", indices: [10, 11], pivot: [0.125, 0.25, 0] },
]

// Separate inner and overlay parts for rendering
const BODY_PARTS_INNER = [
	{ name: "head",     indices: [0],   pivot: [0, 1.0, 0] },
	{ name: "body",     indices: [2],   pivot: null },
	{ name: "leftArm",  indices: [4],   pivot: [-0.375, 1.0, 0] },
	{ name: "rightArm", indices: [6],   pivot: [0.375, 1.0, 0] },
	{ name: "leftLeg",  indices: [8],   pivot: [-0.125, 0.25, 0] },
	{ name: "rightLeg", indices: [10], pivot: [0.125, 0.25, 0] },
]

const BODY_PARTS_OVERLAY = [
	{ name: "head",     indices: [1],   pivot: [0, 1.0, 0] },
	{ name: "body",     indices: [3],   pivot: null },
	{ name: "leftArm",  indices: [5],   pivot: [-0.375, 1.0, 0] },
	{ name: "rightArm", indices: [7],   pivot: [0.375, 1.0, 0] },
	{ name: "leftLeg",  indices: [9],   pivot: [-0.125, 0.25, 0] },
	{ name: "rightLeg", indices: [11], pivot: [0.125, 0.25, 0] },
]

const buildLimbGeometry = () => {
	const shape = shapes.player
	const allVerts = []
	const allUVs = []
	const parts = {} // { name: { quadOffset, quadCount, pivot } }
	const partsInner = {} // inner layer only
	const partsOverlay = {} // overlay layer only

	let quadOffset = 0
	// Build inner layer parts
	for (const part of BODY_PARTS_INNER) {
		const startQuad = quadOffset
		for (let dir = 0; dir < 6; dir++) {
			for (const fi of part.indices) {
				const pos = shape.verts[dir][fi]
				const tex = shape.texVerts[dir][fi]
				for (let k = 0; k < 12; k++) allVerts.push(pos[k])
				for (let k = 0; k < 8; k++) allUVs.push(tex[k])
				quadOffset++
			}
		}
		partsInner[part.name] = {
			quadOffset: startQuad,
			quadCount: quadOffset - startQuad,
			pivot: part.pivot,
		}
	}
	
	// Build overlay layer parts
	for (const part of BODY_PARTS_OVERLAY) {
		const startQuad = quadOffset
		for (let dir = 0; dir < 6; dir++) {
			for (const fi of part.indices) {
				const pos = shape.verts[dir][fi]
				const tex = shape.texVerts[dir][fi]
				for (let k = 0; k < 12; k++) allVerts.push(pos[k])
				for (let k = 0; k < 8; k++) allUVs.push(tex[k])
				quadOffset++
			}
		}
		partsOverlay[part.name] = {
			quadOffset: startQuad,
			quadCount: quadOffset - startQuad,
			pivot: part.pivot,
		}
	}
	
	// Combined parts (for compatibility)
	for (const part of BODY_PARTS) {
		const inner = partsInner[part.name]
		const overlay = partsOverlay[part.name]
		parts[part.name] = {
			quadOffset: inner.quadOffset,
			quadCount: inner.quadCount + overlay.quadCount,
			pivot: part.pivot,
		}
	}

	return {
		verts: new Float32Array(allVerts),
		uvs: new Float32Array(allUVs),
		totalQuads: quadOffset,
		parts,
		partsInner,
		partsOverlay,
	}
}

// ─── SkinnedPlayer Entity ───────────────────────────────────────────────────

class SkinnedPlayer extends Entity {
	constructor(x, y, z, skinTexture, glExtensions, gl, glCache, indexBuffer, world, p) {
		const { verts, uvs, totalQuads, parts, partsInner, partsOverlay } = buildLimbGeometry()

		// Entity base class handles physics. Pass geometry + faces so the VAO is built.
		super(
			x, y, z,
			0, 0,            // pitch, yaw
			0, 0, 0,         // velocity
			0.6, 1.8, 0.6,  // bounding box
			verts, uvs,
			totalQuads,      // total quads (used only for VAO; render uses subranges)
			Infinity,        // never despawn
			glExtensions, gl, glCache, indexBuffer, world, p
		)

		this.skinTexture = skinTexture
		this.parts = parts
		this.partsInner = partsInner
		this.partsOverlay = partsOverlay
		this.gl = gl

		// AI state
		this.aiState = "idle"    // idle | wander | follow
		this.aiTimer = 0
		this.targetYaw = 0
		this.wanderPauseTimer = 0
		this.wanderDuration = 0
		this.walkSpeed = 0.04

		// Walk animation
		this.walkCycle = 0

		// Facial expression system
		this.currentExpression = "neutral"
		this.expressionTimer = 0
		this.lastAiState = "idle"
		
		// Force initial texture update to ensure face is visible
		this._updateSkinTexture()
	}

	// ── AI State Machine ──────────────────────────────────────────────────

	_updateExpression(dt) {
		// Determine expression based on AI state and context
		let targetExpression = "neutral"
		
		// Expression changes based on AI state
		if (this.aiState !== this.lastAiState) {
			// State changed - brief surprised expression
			targetExpression = "surprised"
			this.expressionTimer = 60 // 3 seconds at 20 TPS
			this.lastAiState = this.aiState
		} else if (this.currentExpression === "surprised" && this.expressionTimer > 0) {
			// Still showing surprised expression from state change
			this.expressionTimer -= dt
			if (this.expressionTimer <= 0) {
				// Transition to state-appropriate expression
				switch (this.aiState) {
					case "idle":
						targetExpression = "neutral"
						this.expressionTimer = 100 + random() * 100 // 5-10 seconds
						break
					case "wander":
					case "follow":
						targetExpression = "happy"
						break
				}
			} else {
				// Keep surprised expression
				targetExpression = "surprised"
			}
		} else {
			// Normal state-based expressions
			switch (this.aiState) {
				case "idle":
					// Occasionally look happy or sad while idle
					this.expressionTimer -= dt
					if (this.expressionTimer <= 0) {
						const rand = random()
						if (rand < 0.3) {
							targetExpression = "happy"
						} else if (rand < 0.5) {
							targetExpression = "sad"
						} else {
							targetExpression = "neutral"
						}
						this.expressionTimer = 100 + random() * 100 // 5-10 seconds
					} else {
						// Keep current expression - don't change
						targetExpression = this.currentExpression
					}
					break
				case "wander":
					// Happy while exploring
					targetExpression = "happy"
					break
				case "follow":
					// Happy when following player
					targetExpression = "happy"
					break
			}
		}

		// Update expression if it changed
		if (targetExpression !== this.currentExpression) {
			this.currentExpression = targetExpression
			this._updateSkinTexture()
		}
	}

	_updateSkinTexture() {
		// Regenerate skin with current expression
		const newPixels = generateDefaultSkin(this.currentExpression)
		const gl = this.gl
		
		// Update existing texture - must use TEXTURE1 (same as render)
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, this.skinTexture)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, newPixels)
		gl.bindTexture(gl.TEXTURE_2D, null)
		
		// Restore texture unit 0
		gl.activeTexture(gl.TEXTURE0)
		
		// Debug: log expression change
		console.log("[NPC] Expression changed to:", this.currentExpression)
	}

	update() {
		const now = performance.now()
		let dt = (now - this.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt

		// Update facial expression
		this._updateExpression(dt)

		// Gravity
		this.vely += -0.02 * dt
		if (this.vely < -1.5) this.vely = -1.5

		switch (this.aiState) {
			case "idle":
				this._aiIdle(dt)
				break
			case "wander":
				this._aiWander(dt)
				break
			case "follow":
				this._aiFollow(dt)
				break
		}

		// Horizontal drag
		this.velx *= 0.9
		this.velz *= 0.9

		this.move(now)

		// Update walk cycle based on horizontal speed
		const hSpeed = sqrt(this.velx * this.velx + this.velz * this.velz)
		if (hSpeed > 0.002) {
			this.walkCycle += hSpeed * 10
		} else {
			// Gradually return limbs to rest
			this.walkCycle *= 0.7
			if (this.walkCycle < 0.01) this.walkCycle = 0
		}
	}

	_aiIdle(dt) {
		// Slowly look around randomly
		this.aiTimer -= dt
		if (this.aiTimer <= 0) {
			this.targetYaw = random() * PI * 2
			this.aiTimer = 60 + random() * 80 // 3-7 seconds at 20 TPS
		}
		// Smoothly rotate toward target yaw
		let diff = this.targetYaw - this.yaw
		while (diff > PI) diff -= PI * 2
		while (diff < -PI) diff += PI * 2
		this.yaw += diff * 0.03 * dt
	}

	_aiWander(dt) {
		this.wanderPauseTimer -= dt
		if (this.wanderPauseTimer > 0) {
			// Pausing — just look around
			this._aiIdle(dt)
			return
		}

		this.wanderDuration -= dt
		if (this.wanderDuration <= 0) {
			// Pick new direction, walk for 2-4 seconds, then pause 1-3 seconds
			this.targetYaw = random() * PI * 2
			this.yaw = this.targetYaw
			this.wanderDuration = 40 + random() * 40 // 2-4 sec
			this.wanderPauseTimer = -(20 + random() * 40) // will pause after walking
		}

		// Walk forward
		this.velx += sin(this.yaw) * this.walkSpeed * dt * 0.3
		this.velz += cos(this.yaw) * this.walkSpeed * dt * 0.3

		// When walk duration ends, start a pause
		if (this.wanderDuration <= 0) {
			this.wanderPauseTimer = 20 + random() * 40
		}
	}

	_aiFollow(dt) {
		const p = this.p
		const dx = p.x - this.x
		const dz = p.z - this.z
		const dist = sqrt(dx * dx + dz * dz)

		// Face the player
		this.targetYaw = atan2(dx, dz)
		let diff = this.targetYaw - this.yaw
		while (diff > PI) diff -= PI * 2
		while (diff < -PI) diff += PI * 2
		this.yaw += diff * 0.1 * dt

		if (dist > 3) {
			// Walk toward player
			const speed = this.walkSpeed * dt * 0.4
			this.velx += sin(this.yaw) * speed
			this.velz += cos(this.yaw) * speed
		}
		// If within 3 blocks, just stand and face them
	}

	// ── Render with Per-Limb Animation ────────────────────────────────────

	render() {
		const { gl, glCache, glExtensions, p } = this

		// Camera matrices
		const viewMatrix = p.transformation.elements
		const proj = p.projection
		const projectionMatrix = [
			proj[0], 0, 0, 0,
			0, proj[1], 0, 0,
			0, 0, proj[2], proj[3],
			0, 0, proj[4], 0
		]

		// Bind skin texture
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, this.skinTexture)
		gl.uniform1i(glCache.uSamplerEntity, 1)
		gl.uniform1f(glCache.uLightLevelEntity, 1.0)


		// Bind the single VAO (all body parts in one buffer)
		glExtensions.vertex_array_object.bindVertexArrayOES(this.vao)

		const scale = 0.9
		const swing = sin(this.walkCycle) * 0.6
		const headBob = sin(this.walkCycle * 2) * 0.04

		// Helper function to build and apply transform
		const drawPart = (part, name) => {
			const { quadOffset, quadCount, pivot } = part

			// Build model matrix
			const m = new Matrix()
			m.identity()
			m.translate(this.x, this.y, this.z)
			m.rotY(this.yaw + PI)  // Add 180 degrees so NPC faces forward direction
			m.scale(scale, scale, scale)
			m.translate(0, -0.5, 0)

			// Apply limb rotation around pivot
			if (pivot) {
				let angle = 0
				switch (name) {
					case "head":
						angle = headBob
						break
					case "rightArm":
						angle = swing
						break
					case "leftArm":
						angle = -swing
						break
					case "rightLeg":
						angle = -swing
						break
					case "leftLeg":
						angle = swing
						break
				}
				if (angle !== 0) {
					m.translate(pivot[0], pivot[1], pivot[2])
					m.rotX(angle)
					m.translate(-pivot[0], -pivot[1], -pivot[2])
				}
			}

			// Build MVP
			const mvp = new Matrix()
			mvp.identity()
			mvp.mult(projectionMatrix)
			mvp.mult(viewMatrix)
			mvp.mult(m.elements)
			mvp.transpose()

			gl.uniformMatrix4fv(glCache.uViewEntity, false, mvp.elements)

			// Draw this body part's quad range
			const indexOffset = quadOffset * 6 * 4  // byte offset into index buffer (6 indices × 4 bytes per Uint32)
			gl.drawElements(gl.TRIANGLES, quadCount * 6, gl.UNSIGNED_INT, indexOffset)
		}

		// FIRST: Draw inner layer (normal depth testing)
		for (const name in this.partsInner) {
			drawPart(this.partsInner[name], name)
		}

		// SECOND: Draw overlay layer with LEQUAL depth function so it renders on top
		const oldDepthFunc = gl.getParameter(gl.DEPTH_FUNC)
		gl.depthFunc(gl.LEQUAL)  // Allow overlay to render at same depth as inner
		for (const name in this.partsOverlay) {
			drawPart(this.partsOverlay[name], name)
		}
		gl.depthFunc(oldDepthFunc)  // Restore original depth function

		glExtensions.vertex_array_object.bindVertexArrayOES(null)

		// Restore texture unit 0 to block atlas (CRITICAL: blocks expect this)
		gl.activeTexture(gl.TEXTURE0)
		if (state.blockAtlasTexture) {
			gl.bindTexture(gl.TEXTURE_2D, state.blockAtlasTexture)
		}
		gl.uniform1i(glCache.uSamplerEntity, 0)
	}
}

// ─── NPC Management Helpers ─────────────────────────────────────────────────

let defaultSkinTexture = null

const spawnNPC = (world, skinTexture = null) => {
	if (state.npc) return // only 1 NPC at a time

	const gl = state.gl
	// Always create a new texture for each NPC so expressions can update independently
	// Use provided skin, or create new default skin with neutral expression
	const texture = skinTexture || createSkinTexture(gl, generateDefaultSkin("neutral"))

	const p = state.p
	const spawnX = p.x + sin(p.ry) * 4
	const spawnZ = p.z + cos(p.ry) * 4

	const npc = new SkinnedPlayer(
		spawnX, p.y, spawnZ,
		texture,
		state.glExtensions, gl, state.glCache, state.indexBuffer,
		world, state.p
	)
	world.entities.push(npc)
	state.npc = npc
	console.log("[NPC] NPC spawned at", spawnX.toFixed(1), p.y.toFixed(1), spawnZ.toFixed(1))
}

const deleteNPC = (world) => {
	if (!state.npc) return
	state.npc.canDespawn = true // world.tick() will remove it
	state.npc = null
	// Note: We keep defaultSkinTexture cached for reuse
	console.log("[NPC] NPC deleted")
}

const setNPCState = (aiState) => {
	if (!state.npc) return
	state.npc.aiState = aiState
	// Reset AI timers so new state starts fresh
	state.npc.aiTimer = 0
	state.npc.wanderPauseTimer = 0
	state.npc.wanderDuration = 0
	console.log("[NPC] AI state set to", aiState)
}

export {
	SkinnedPlayer,
	generateDefaultSkin,
	createSkinTexture,
	loadSkinFromImage,
	loadSkinFromUrl,
	spawnNPC,
	deleteNPC,
	setNPCState,
}
