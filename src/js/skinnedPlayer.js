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

const generateDefaultSkin = () => {
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

	// Colors
	const WHITE  = [240, 240, 235]
	const BLACK  = [26, 26, 30]
	const GREY   = [200, 200, 195]
	const DGREY  = [60, 60, 65]
	const NOSE   = [50, 45, 42]
	const EYE_W  = [255, 255, 255]

	// All coordinates are in 64x64 space, multiply by 4 for 256x256 texture
	// ── HEAD (inner layer) ──
	// Top (8,0) 8×8 — white with black ears
	rect(8*4, 0*4, 8*4, 8*4, ...WHITE)
	rect(8*4, 0*4, 2*4, 3*4, ...BLACK)   // left ear
	rect(14*4, 0*4, 2*4, 3*4, ...BLACK)  // right ear

	// Bottom (16,0) 8×8 — white chin
	rect(16*4, 0*4, 8*4, 8*4, ...WHITE)

	// Right side (0,8) 8×8
	rect(0*4, 8*4, 8*4, 8*4, ...WHITE)
	rect(0*4, 8*4, 2*4, 3*4, ...BLACK) // ear edge

	// Front face (8,8) 8×8
	rect(8*4, 8*4, 8*4, 8*4, ...WHITE)
	// Black eye patches
	rect(9*4, 10*4, 2*4, 2*4, ...BLACK)   // left patch
	rect(13*4, 10*4, 2*4, 2*4, ...BLACK)  // right patch
	// White pupils inside patches
	set(9*4, 10*4, ...EYE_W)
	set(14*4, 10*4, ...EYE_W)
	// Nose
	set(11*4, 12*4, ...NOSE)
	set(12*4, 12*4, ...NOSE)
	// Mouth
	set(11*4, 13*4, ...DGREY)
	set(12*4, 13*4, ...DGREY)

	// Left side (16,8) 8×8
	rect(16*4, 8*4, 8*4, 8*4, ...WHITE)
	rect(22*4, 8*4, 2*4, 3*4, ...BLACK) // ear edge

	// Back (24,8) 8×8
	rect(24*4, 8*4, 8*4, 8*4, ...WHITE)
	rect(24*4, 8*4, 2*4, 3*4, ...BLACK)  // left ear back
	rect(30*4, 8*4, 2*4, 3*4, ...BLACK)  // right ear back

	// ── BODY (inner layer) ──
	// Top (20,16) 8×4
	rect(20*4, 16*4, 8*4, 4*4, ...WHITE)
	// Bottom (28,16) 8×4
	rect(28*4, 16*4, 8*4, 4*4, ...WHITE)
	// Right (16,20) 4×12
	rect(16*4, 20*4, 4*4, 12*4, ...WHITE)
	// Front (20,20) 8×12 — white with dark belly patch
	rect(20*4, 20*4, 8*4, 12*4, ...WHITE)
	rect(22*4, 22*4, 4*4, 6*4, ...GREY)
	// Left (28,20) 4×12
	rect(28*4, 20*4, 4*4, 12*4, ...WHITE)
	// Back (32,20) 8×12
	rect(32*4, 20*4, 8*4, 12*4, ...WHITE)
	rect(34*4, 22*4, 4*4, 6*4, ...GREY)

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

	// Overlay layers (rows 32-47 for head/body/arms, 48-63 for legs) are
	// left at alpha=0 (transparent) so only the inner skin renders.

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
	{ name: "head",     indices: [0, 1],   pivot: [0, 1.0, 0] },
	{ name: "body",     indices: [2, 3],   pivot: null },         // no rotation
	{ name: "leftArm",  indices: [4, 5],   pivot: [-0.375, 1.0, 0] },
	{ name: "rightArm", indices: [6, 7],   pivot: [0.375, 1.0, 0] },
	{ name: "leftLeg",  indices: [8, 9],   pivot: [-0.125, 0.25, 0] },
	{ name: "rightLeg", indices: [10, 11], pivot: [0.125, 0.25, 0] },
]

const buildLimbGeometry = () => {
	const shape = shapes.player
	const allVerts = []
	const allUVs = []
	const parts = {} // { name: { quadOffset, quadCount, pivot } }

	let quadOffset = 0
	for (const part of BODY_PARTS) {
		const startQuad = quadOffset
		for (let dir = 0; dir < 6; dir++) {
			for (const fi of part.indices) {
				const pos = shape.verts[dir][fi]
				const tex = shape.texVerts[dir][fi]
				// 4 vertices per quad
				for (let k = 0; k < 12; k++) allVerts.push(pos[k])
				for (let k = 0; k < 8; k++) allUVs.push(tex[k])
				quadOffset++
			}
		}
		parts[part.name] = {
			quadOffset: startQuad,
			quadCount: quadOffset - startQuad,
			pivot: part.pivot,
		}
	}

	return {
		verts: new Float32Array(allVerts),
		uvs: new Float32Array(allUVs),
		totalQuads: quadOffset,
		parts,
	}
}

// ─── SkinnedPlayer Entity ───────────────────────────────────────────────────

class SkinnedPlayer extends Entity {
	constructor(x, y, z, skinTexture, glExtensions, gl, glCache, indexBuffer, world, p) {
		const { verts, uvs, totalQuads, parts } = buildLimbGeometry()

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

		// AI state
		this.aiState = "idle"    // idle | wander | follow
		this.aiTimer = 0
		this.targetYaw = 0
		this.wanderPauseTimer = 0
		this.wanderDuration = 0
		this.walkSpeed = 0.04

		// Walk animation
		this.walkCycle = 0
	}

	// ── AI State Machine ──────────────────────────────────────────────────

	update() {
		const now = performance.now()
		let dt = (now - this.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt

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

		// Draw each body part with its own transform
		for (const name in this.parts) {
			const part = this.parts[name]
			const { quadOffset, quadCount, pivot } = part

			// Build model matrix
			const m = new Matrix()
			m.identity()
			m.translate(this.x, this.y, this.z)
			m.rotY(this.yaw)
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
	// Use provided skin, or fall back to default skin generator
	const texture = skinTexture || (defaultSkinTexture || 
		(defaultSkinTexture = createSkinTexture(gl, generateDefaultSkin())))

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
