// arrow.js - Arrow projectile entity for bow and arrow mechanic
import { Entity } from "./entity.js"
import { Matrix } from "./3Dutils.js"
import { state } from "./state.js"

const { sin, cos, atan2, sqrt, round, PI } = Math

class Arrow extends Entity {
	constructor(x, y, z, velx, vely, velz, glExtensions, gl, glCache, indexBuffer, world, p) {
		// Create arrow geometry - detailed 3D model with shaft, tip, and fins
		const arrowLength = 0.5
		const shaftRadius = 0.02
		const tipLength = 0.1
		const tipRadius = 0.04
		const finSize = 0.06
		
		// Build arrow mesh: shaft (cylinder) + tip (cone) + fins (triangles)
		const vertices = Arrow.createArrowGeometry(arrowLength, shaftRadius, tipLength, tipRadius, finSize)
		const texture = Arrow.createArrowTexture(vertices.length / 3)
		const faces = vertices.length / 12 // 4 vertices per face, 3 coords per vertex
		
		super(x, y, z, 0, 0, velx, vely, velz, 0.1, 0.1, arrowLength, vertices, texture, faces, Infinity, glExtensions, gl, glCache, indexBuffer, world, p)
		
		this.stuck = false
		this.stuckX = 0
		this.stuckY = 0
		this.stuckZ = 0
		this.stuckTime = 0
		this.stuckBlock = 0
		this.lifetime = 30000 // 30 seconds before despawn
		this.initialVel = sqrt(velx * velx + vely * vely + velz * velz)
	}
	
	static createArrowGeometry(length, shaftRadius, tipLength, tipRadius, finSize) {
		const vertices = []
		const segments = 8 // Number of sides for cylinder/cone
		
		// Arrow shaft (cylinder from 0 to length - tipLength)
		const shaftEnd = length - tipLength
		for (let i = 0; i < segments; i++) {
			const angle1 = (i / segments) * 2 * PI
			const angle2 = ((i + 1) / segments) * 2 * PI
			
			const x1 = cos(angle1) * shaftRadius
			const y1 = sin(angle1) * shaftRadius
			const x2 = cos(angle2) * shaftRadius
			const y2 = sin(angle2) * shaftRadius
			
			// Quad as two triangles
			// Triangle 1
			vertices.push(x1, y1, 0)
			vertices.push(x2, y2, 0)
			vertices.push(x1, y1, shaftEnd)
			// Triangle 2
			vertices.push(x2, y2, 0)
			vertices.push(x2, y2, shaftEnd)
			vertices.push(x1, y1, shaftEnd)
		}
		
		// Arrow tip (cone from shaftEnd to length)
		const tipStart = shaftEnd
		for (let i = 0; i < segments; i++) {
			const angle1 = (i / segments) * 2 * PI
			const angle2 = ((i + 1) / segments) * 2 * PI
			
			const x1 = cos(angle1) * tipRadius
			const y1 = sin(angle1) * tipRadius
			const x2 = cos(angle2) * tipRadius
			const y2 = sin(angle2) * tipRadius
			
			// Triangle from base to tip point
			vertices.push(x1, y1, tipStart)
			vertices.push(x2, y2, tipStart)
			vertices.push(0, 0, length)
		}
		
		// Arrow fins (4 perpendicular triangular fins at the back)
		const finPositions = [
			{ x: 0, y: finSize },   // Top
			{ x: 0, y: -finSize },  // Bottom
			{ x: finSize, y: 0 },   // Right
			{ x: -finSize, y: 0 }   // Left
		]
		
		for (const fin of finPositions) {
			vertices.push(fin.x, fin.y, 0)
			vertices.push(0, 0, 0)
			vertices.push(fin.x * 0.3, fin.y * 0.3, 0.08)
		}
		
		return new Float32Array(vertices)
	}
	
	static createArrowTexture(vertexCount) {
		// Simple brown/gray texture coordinates for arrow
		// Map to a brown region of the texture atlas (wood-like)
		const texture = []
		const texX = 0.5 // Middle of texture atlas
		const texY = 0.5
		
		for (let i = 0; i < vertexCount; i++) {
			texture.push(texX, texY)
		}
		
		return new Float32Array(texture)
	}
	
	updateVelocity(now) {
		let dt = (now - this.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt
		
		if (!this.stuck) {
			// Apply gravity only (no drag for arrows in flight)
			this.vely += -0.025 * dt
			
			// Cap falling speed
			if (this.vely < -2) {
				this.vely = -2
			}
		} else {
			// No velocity when stuck
			this.velx = 0
			this.vely = 0
			this.velz = 0
		}
	}
	
	update() {
		const now = performance.now()
		
		if (this.stuck) {
			// Check if stuck block still exists
			const block = this.world.getBlock(this.stuckX, this.stuckY, this.stuckZ)
			if (!block || block === 0) {
				// Block was destroyed, arrow should fall
				this.stuck = false
				this.vely = -0.1
			}
			
			// Check if lifetime exceeded
			if (now - this.stuckTime > this.lifetime) {
				this.canDespawn = true
			}
			
			this.lastUpdate = now
			return
		}
		
		this.updateVelocity(now)
		
		// Save previous position
		const prevX = this.x
		const prevY = this.y
		const prevZ = this.z
		
		// Move the arrow
		this.move(now)
		
		// Check if arrow hit something (position changed less than expected or collision detected)
		const expectedDist = sqrt(this.velx * this.velx + this.vely * this.vely + this.velz * this.velz)
		const actualDist = sqrt((this.x - prevX) ** 2 + (this.y - prevY) ** 2 + (this.z - prevZ) ** 2)
		
		if (expectedDist > 0.01 && actualDist < expectedDist * 0.5) {
			// Arrow hit something - stick it
			this.stuck = true
			this.stuckX = round(this.x)
			this.stuckY = round(this.y)
			this.stuckZ = round(this.z)
			this.stuckTime = now
			this.stuckBlock = this.world.getBlock(this.stuckX, this.stuckY, this.stuckZ)
			
			// Calculate and store orientation for rendering when stuck
			const horizontalDist = sqrt(this.velx * this.velx + this.velz * this.velz)
			this.pitch = -atan2(this.vely, horizontalDist)
			this.yaw = atan2(this.velx, this.velz)
			
			this.velx = 0
			this.vely = 0
			this.velz = 0
		}
	}
	
	render() {
		const { gl, glCache, glExtensions, p } = this
		
		if (!p || !p.transformation) return
		
		const modelMatrix = new Matrix()
		modelMatrix.identity()
		modelMatrix.translate(this.x, this.y, this.z)
		
		// Rotate arrow to point in direction of velocity (or stuck direction)
		if (!this.stuck && (this.velx !== 0 || this.vely !== 0 || this.velz !== 0)) {
			const horizontalDist = sqrt(this.velx * this.velx + this.velz * this.velz)
			const pitch = atan2(this.vely, horizontalDist)
			const yaw = atan2(this.velx, this.velz)
			
			modelMatrix.rotY(yaw)
			modelMatrix.rotX(-pitch)
		} else if (this.stuck) {
			// Maintain stuck orientation
			modelMatrix.rotY(this.yaw)
			modelMatrix.rotX(this.pitch)
		}
		
		modelMatrix.scale(1, 1, 1)
		
		const viewMatrix = p.transformation.elements
		const proj = p.projection
		const projectionMatrix = [proj[0], 0, 0, 0, 0, proj[1], 0, 0, 0, 0, proj[2], proj[3], 0, 0, proj[4], 0]
		
		const modelViewProjectionMatrix = new Matrix()
		modelViewProjectionMatrix.identity()
		modelViewProjectionMatrix.mult(projectionMatrix)
		modelViewProjectionMatrix.mult(viewMatrix)
		modelViewProjectionMatrix.mult(modelMatrix.elements)
		modelViewProjectionMatrix.transpose()
		
		const lightLevel = 1
		gl.bindTexture(gl.TEXTURE_2D, state.blockAtlasTexture)
		gl.uniform1i(glCache.uSamplerEntity, 0)
		gl.uniform1f(glCache.uLightLevelEntity, lightLevel)
		gl.uniformMatrix4fv(glCache.uViewEntity, false, modelViewProjectionMatrix.elements)
		
		glExtensions.vertex_array_object.bindVertexArrayOES(this.vao)
		gl.drawElements(gl.TRIANGLES, 6 * this.faces, gl.UNSIGNED_INT, 0)
		glExtensions.vertex_array_object.bindVertexArrayOES(null)
	}
}

export { Arrow }
