// camera.js - Camera class with FOV, frustum culling, and view transforms
import { state } from './state.js'
import { PVector, Matrix, Plane, cross } from './3Dutils.js'

const { sin, cos } = Math

const defaultTransformation = new Matrix([-10,0,0,0,0,10,0,0,0,0,-10,0,0,0,0,1])

class Camera {
	constructor() {
		this.x = 0
		this.y = 0
		this.z = 0
		this.px = 0
		this.py = 0
		this.pz = 0
		this.rx = 0
		this.ry = 0
		this.prx = 0
		this.pry = 0
		this.currentFov = 0
		this.defaultFov = state.settings.fov
		this.targetFov = state.settings.fov
		this.step = 0
		this.lastStep = 0
		this.projection = new Float32Array(5)
		this.transformation = new Matrix()
		this.direction = { x: 1, y: 0, z: 0 }
		this.frustum = []
		for (let i = 0; i < 5; i++) {
			this.frustum.push(new Plane(1, 0, 0))
		}
	}
	FOV(fov, time) {
		if (fov === this.currentFov) return
		if (!fov) {
			fov = this.currentFov + this.step * (state.now - this.lastStep)
			this.lastStep = state.now
			if (Math.sign(this.targetFov - this.currentFov) !== Math.sign(this.targetFov - fov)) {
				fov = this.targetFov
			}
		}
		else if (time) {
			this.targetFov = fov
			this.step = (fov - this.currentFov) / time
			this.lastStep = state.now
			return
		}
		else {
			this.targetFov = fov
		}
		const tang = Math.tan(fov * Math.PI / 360)
		const scale = 1 / tang
		const near = 1
		const far = 1000000
		this.currentFov = fov
		this.nearH = near * tang
		this.projection[0] = scale / state.width * state.height
		this.projection[1] = scale
		this.projection[2] = -far / (far - near)
		this.projection[3] = -1
		this.projection[4] = -far * near / (far - near)
	}
	transform() {
		let diff = (performance.now() - this.lastUpdate) / 50
		if (diff > 1 || isNaN(diff)) diff = 1
		let x = (this.x - this.px) * diff + this.px
		let y = (this.y - this.py) * diff + this.py
		let z = (this.z - this.pz) * diff + this.pz
		this.transformation.copyMatrix(defaultTransformation)
		if (this.rx) this.transformation.rotX(this.rx)
		if (this.ry) this.transformation.rotY(this.ry)
		this.transformation.translate(-x, -y, -z)
	}
	getMatrix() {
		let proj = this.projection
		let view = this.transformation.elements
		let m = state.matrix
		m[0]  = proj[0] * view[0]
		m[1]  = proj[1] * view[4]
		m[2]  = proj[2] * view[8] + proj[3] * view[12]
		m[3]  = proj[4] * view[8]
		m[4]  = proj[0] * view[1]
		m[5]  = proj[1] * view[5]
		m[6]  = proj[2] * view[9] + proj[3] * view[13]
		m[7]  = proj[4] * view[9]
		m[8]  = proj[0] * view[2]
		m[9]  = proj[1] * view[6]
		m[10] = proj[2] * view[10] + proj[3] * view[14]
		m[11] = proj[4] * view[10]
		m[12] = proj[0] * view[3]
		m[13] = proj[1] * view[7]
		m[14] = proj[2] * view[11] + proj[3] * view[15]
		m[15] = proj[4] * view[11]
		return m
	}
	setDirection() {
		if (this.targetFov !== this.currentFov) {
			this.FOV()
		}
		this.direction.x = -sin(this.ry) * cos(this.rx)
		this.direction.y = sin(this.rx)
		this.direction.z = cos(this.ry) * cos(this.rx)
		this.computeFrustum()
	}
	computeFrustum() {
		let X = state.vec1
		let dir = this.direction
		X.x = dir.z
		X.y = 0
		X.z = -dir.x
		X.normalize()
		let Y = state.vec2
		Y.set(dir)
		Y.mult(-1)
		cross(Y, X, Y)
		this.frustum[0].set(dir.x, dir.y, dir.z)
		let aux = state.vec3
		aux.set(Y)
		aux.mult(this.nearH)
		aux.add(dir)
		aux.normalize()
		cross(aux, X, aux)
		this.frustum[1].set(aux.x, aux.y, aux.z)
		aux.set(Y)
		aux.mult(-this.nearH)
		aux.add(dir)
		aux.normalize()
		cross(X, aux, aux)
		this.frustum[2].set(aux.x, aux.y, aux.z)
		aux.set(X)
		aux.mult(-this.nearH * state.width / state.height)
		aux.add(dir)
		aux.normalize()
		cross(aux, Y, aux)
		this.frustum[3].set(aux.x, aux.y, aux.z)
		aux.set(X)
		aux.mult(this.nearH * state.width / state.height)
		aux.add(dir)
		aux.normalize()
		cross(Y, aux, aux)
		this.frustum[4].set(aux.x, aux.y, aux.z)
	}
	canSee(x, y, z, maxY) {
		x -= 0.5
		y -= 0.5
		z -= 0.5
		maxY += 0.5
		let p = state.p
		let cx = p.x - p.velocity.x, cy = p.y - p.velocity.y, cz = p.z - p.velocity.z
		for (let i = 0; i < 5; i++) {
			let plane = this.frustum[i]
			let px = x + plane.dx
			let py = plane.dy ? maxY : y
			let pz = z + plane.dz
			if ((px - cx) * plane.nx + (py - cy) * plane.ny + (pz - cz) * plane.nz < 0) {
				return false
			}
		}
		return true
	}
}

export { Camera, defaultTransformation }
