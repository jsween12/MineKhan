// physics.js - Collision detection, contacts, gravity, and position resolution
import { state } from './state.js'
import { blockData } from './blockData.js'
import { roundBits } from './utils.js'
import { lookingAt } from './raytrace.js'

const { floor, ceil, round, min, max, abs } = Math

const collide = (faces, compare = max, index = 0, offset = 0) => {
	let p = state.p
	if (p.spectator) {
		if (state.p2.y === 2 && index === 1 && faces.length && p.velocity.y <= 0) return 0.5 + p.bottomH
		return false
	}
	let col = false
	let pos = 0
	for (let face of faces) {
		const [minX, minY, minZ, maxX, maxY, maxZ] = face
		const cy = index === 1 ? p.minY() <= maxY : p.minY() < maxY
		let colliding = p.minX() < maxX && p.maxX() > minX && cy && p.maxY() > minY && p.minZ() < maxZ && p.maxZ() > minZ
		if (colliding) {
			pos = col ? compare(pos, face[index] + offset) : face[index] + offset
			col = true
		}
	}
	return col && pos
}

const contacts = {
	faces: [[], [], [], [], [], []],
	add: function(x, y, z, verts) {
		let p = state.p
		for (let dir = 0; dir < 6; dir++) {
			for (let i = 0; i < verts[dir].length; i++) {
				const face = verts[dir][i]
				const fminX = roundBits(min(face[0], face[6]) + x - state.p2.x)
				const fmaxX = roundBits(max(face[0], face[6]) + x - state.p2.x)
				const fminY = roundBits(min(face[1], face[7]) + y - state.p2.y)
				const fmaxY = roundBits(max(face[1], face[7]) + y - state.p2.y)
				const fminZ = roundBits(min(face[2], face[8]) + z - state.p2.z)
				const fmaxZ = roundBits(max(face[2], face[8]) + z - state.p2.z)
				this.faces[dir].push([fminX, fminY, fminZ, fmaxX, fmaxY, fmaxZ])
			}
		}
	},
	clear: function() {
		for (let i = 0; i < 6; i++) this.faces[i].length = 0
	},
}

const resolveContactsAndUpdatePosition = () => {
	let p = state.p
	if (p.y < 0) p.y = 70

	let mag = p.velocity.mag()
	let steps = Math.ceil(mag / p.w)
	let VX = p.velocity.x / steps
	let VY = p.velocity.y / steps
	let VZ = p.velocity.z / steps

	let pminX = floor(0.5 + p.x - p.w + (p.velocity.x < 0 ? p.velocity.x : 0))
	let pmaxX = ceil(-0.5 + p.x + p.w + (p.velocity.x > 0 ? p.velocity.x : 0))
	let pminY = max(floor(0.5 + p.y - p.bottomH + (p.velocity.y < 0 ? p.velocity.y : 0)), 0)
	let pmaxY = min(ceil(p.y + p.topH + (p.velocity.y > 0 ? p.velocity.y : 0)), state.maxHeight)
	let pminZ = floor(0.5 + p.z - p.w + (p.velocity.z < 0 ? p.velocity.z : 0))
	let pmaxZ = ceil(-0.5 + p.z + p.w + (p.velocity.z > 0 ? p.velocity.z : 0))

	for (let y = pmaxY; y >= pminY; y--) {
		for (let x = pminX; x <= pmaxX; x++) {
			for (let z = pminZ; z <= pmaxZ; z++) {
				let block = state.world.getBlock(x, y, z)
				const data = blockData[block]
				if (data.solid) {
					let shape = data.shape
					if (shape.getShape) shape = shape.getShape(x, y, z, state.world, blockData)
					contacts.add(x, y, z, shape.verts)
				}
			}
		}
	}

	p.px = p.x
	p.py = p.y
	p.pz = p.z
	p.onGround = false
	for (let j = 1; j <= steps; j++) {
		let px = p.x
		let pz = p.z

		p.y += VY
		if (VY > 0) {
			let npy = collide(contacts.faces[0], min, 1, state.p2.y - p.topH - 0.01)
			if (npy !== false) { p.y = npy; p.velocity.y = 0 }
		} else {
			let npy = collide(contacts.faces[1], max, 1, state.p2.y + p.bottomH)
			if (npy !== false) { p.onGround = true; p.y = npy; p.velocity.y = 0 }
		}

		if (VX) {
			p.x += VX
			let npx
			if (VX > 0) npx = collide(contacts.faces[5], min, 0, state.p2.x - p.w)
			else npx = collide(contacts.faces[4], max, 0, state.p2.x + p.w)
			if (npx !== false) {
				if (p.onGround) {
					p.y += 0.5
					if (collide(contacts.faces[0]) === false) {
						if (VX > 0) npx = collide(contacts.faces[5], min, 0, state.p2.x - p.w)
						else npx = collide(contacts.faces[4], max, 0, state.p2.x + p.w)
					}
					p.y -= 0.5
				}
				if (npx !== false) { p.x = npx; p.velocity.x = 0 }
			}
			if (p.sneaking && p.onGround) {
				if (collide(contacts.faces[1], max, 1, state.p2.y + p.bottomH) === false) { p.x = px; p.velocity.x = 0 }
			}
		}

		if (VZ) {
			p.z += VZ
			let npz
			if (VZ > 0) npz = collide(contacts.faces[3], min, 2, state.p2.z - p.w)
			else npz = collide(contacts.faces[2], max, 2, state.p2.z + p.w)
			if (npz !== false) {
				if (p.onGround) {
					p.y += 0.5
					if (collide(contacts.faces[0]) === false) {
						if (VZ > 0) npz = collide(contacts.faces[3], min, 2, state.p2.z - p.w)
						else npz = collide(contacts.faces[2], max, 2, state.p2.z + p.w)
					}
					p.y -= 0.5
				}
				if (npz !== false) { p.z = npz; p.velocity.z = 0 }
			}
			if (p.sneaking && p.onGround) {
				if (collide(contacts.faces[1], max, 1, state.p2.y + p.bottomH) === false) { p.z = pz; p.velocity.z = 0 }
			}
		}

		if (p.velocity.x === 0) VX = 0
		if (p.velocity.y === 0) VY = 0
		if (p.velocity.z === 0) VZ = 0
	}

	if (!p.flying) {
		let drag = p.onGround ? 0.5 : 0.85
		p.velocity.z += p.velocity.z * drag - p.velocity.z
		p.velocity.x += p.velocity.x * drag - p.velocity.x
	} else {
		let drag = 0.9
		if (!state.controlMap.walkForwards.pressed && !state.controlMap.walkBackwards.pressed && !state.controlMap.strafeLeft.pressed && !state.controlMap.strafeRight.pressed) drag = 0.7
		p.velocity.z += p.velocity.z * drag - p.velocity.z
		p.velocity.x += p.velocity.x * drag - p.velocity.x
		p.velocity.y += p.velocity.y * 0.7 - p.velocity.y
		if (p.onGround && !p.spectator) p.flying = false
	}

	p.lastUpdate = performance.now()
	contacts.clear()
	lookingAt()
}

const runGravity = () => {
	let p = state.p
	if (p.flying) return
	p.velocity.y += p.gravityStrength
	if (p.velocity.y < -p.maxYVelocity) p.velocity.y = -p.maxYVelocity
	if (p.onGround) {
		if (state.controlMap.jump.pressed) {
			p.velocity.y = p.jumpSpeed
			p.onGround = false
		}
	}
}

const controls = () => {
	let p = state.p
	let move = state.move
	move.x = 0
	move.z = 0
	if (state.controlMap.walkForwards.pressed) move.z += p.speed
	if (state.controlMap.walkBackwards.pressed) move.z -= p.speed
	if (state.controlMap.strafeLeft.pressed) move.x += p.speed
	if (state.controlMap.strafeRight.pressed) move.x -= p.speed
	if (p.flying) {
		if (state.controlMap.jump.pressed) p.velocity.y += 0.1
		if (state.controlMap.sneak.pressed) p.velocity.y -= 0.1
	}
	if (state.Key.ArrowLeft) p.ry -= 0.15
	if (state.Key.ArrowRight) p.ry += 0.15
	if (state.Key.ArrowUp) p.rx += 0.15
	if (state.Key.ArrowDown) p.rx -= 0.15
	if (!p.sprinting && state.controlMap.sprint.pressed && !p.sneaking && state.controlMap.walkForwards.pressed) {
		p.FOV(state.settings.fov + 10, 250)
		p.sprinting = true
	}
	if (p.sprinting) { move.x *= p.sprintSpeed; move.z *= p.sprintSpeed }
	if (p.flying) { move.x *= p.flySpeed; move.z *= p.flySpeed }
	if (!move.x && !move.z) {
		if (p.sprinting) p.FOV(state.settings.fov, 100)
		p.sprinting = false
	} else if (abs(move.x) > 0 && abs(move.z) > 0) {
		move.x *= move.ang; move.z *= move.ang
	}
	let co = Math.cos(p.ry)
	let si = Math.sin(p.ry)
	let friction = p.onGround ? 1 : 0.3
	p.velocity.x += (co * move.x - si * move.z) * friction
	p.velocity.z += (si * move.x + co * move.z) * friction
	const TAU = Math.PI * 2
	const PI1_2 = Math.PI / 2
	while (p.ry > TAU) p.ry -= TAU
	while (p.ry < 0) p.ry += TAU
	if (p.rx > PI1_2) p.rx = PI1_2
	if (p.rx < -PI1_2) p.rx = -PI1_2
}

export { resolveContactsAndUpdatePosition, runGravity, controls }
