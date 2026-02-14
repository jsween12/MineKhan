// renderer.js - WebGL initialization, mode switching, icons, and shape setup
import { state, fill, strokeWeight } from './state.js'
import { createProgramObject } from './glUtils.js'
import { initTextures, animateTextures, hitboxTextureCoords } from './texture.js'
import { getSkybox } from './sky'
import { shapes, CUBE, SLAB, STAIR } from './shapes.js'
import { blockData, BLOCK_COUNT, BlockData } from './blockData.js'
import { Matrix } from './3Dutils.js'

const use2d = () => {
	let gl = state.gl, glCache = state.glCache
	gl.disableVertexAttribArray(glCache.aSkylight)
	gl.disableVertexAttribArray(glCache.aBlocklight)
	gl.enableVertexAttribArray(glCache.aVertex2)
	gl.enableVertexAttribArray(glCache.aTexture2)
	gl.enableVertexAttribArray(glCache.aShadow2)
	gl.useProgram(state.program2D)
	gl.uniform2f(glCache.uOffset, 0, 0)
	gl.depthFunc(gl.ALWAYS)
}

const use3d = () => {
	let gl = state.gl, glCache = state.glCache
	gl.useProgram(state.program3D)
	gl.enableVertexAttribArray(glCache.aVertex)
	gl.enableVertexAttribArray(glCache.aTexture)
	gl.enableVertexAttribArray(glCache.aShadow)
	gl.enableVertexAttribArray(glCache.aSkylight)
	gl.enableVertexAttribArray(glCache.aBlocklight)
	gl.activeTexture(gl.TEXTURE0)
}

const dirt = () => {
	state.ctx.clearRect(0, 0, state.width, state.height)
	use2d()
	let gl = state.gl, glCache = state.glCache
	gl.bindBuffer(gl.ARRAY_BUFFER, state.dirtBuffer)
	gl.uniform1i(glCache.uSampler2, 1)
	gl.vertexAttribPointer(glCache.aVertex2, 2, gl.FLOAT, false, 20, 0)
	gl.vertexAttribPointer(glCache.aTexture2, 2, gl.FLOAT, false, 20, 8)
	gl.vertexAttribPointer(glCache.aShadow2, 1, gl.FLOAT, false, 20, 16)
	gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}

const initDirt = () => {
	let gl = state.gl
	let aspect = state.width / state.height
	let stack = state.height / 96
	let bright = 0.4
	if (!state.dirtBuffer) state.dirtBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, state.dirtBuffer)
	let bgCoords = new Float32Array([
		-1, -1, 0, stack, bright,
		1, -1, stack * aspect, stack, bright,
		1, 1, stack * aspect, 0, bright,
		-1, 1, 0, 0, bright
	])
	gl.bufferData(gl.ARRAY_BUFFER, bgCoords, gl.STATIC_DRAW)
	dirt()
}

const initShapes = () => {
	let gl = state.gl
	for (let shape in shapes) {
		let obj = shapes[shape]
		obj.buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.verts.flat(2)), gl.STATIC_DRAW)
		for (let i in obj.variants) {
			let v = obj.variants[i]
			v.buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, v.buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v.verts.flat(2)), gl.STATIC_DRAW)
		}
	}
	for (let id = 1; id < BLOCK_COUNT; id++) {
		let baseBlock = blockData[id]
		if (baseBlock.shape === shapes.door) baseBlock.rotate = true
		if (!baseBlock.uniqueShape) {
			const slabBlock = new BlockData(baseBlock, id | SLAB, true)
			slabBlock.transparent = true
			slabBlock.name += " Slab"
			slabBlock.shape = shapes.slab
			slabBlock.flip = true
			blockData[id | SLAB] = slabBlock
			let v = slabBlock.shape.variants
			for (let j = 1; j < v.length; j++) {
				if (v[j]) {
					let block = new BlockData(slabBlock, id | SLAB | j << 10, false)
					block.shape = v[j]
					blockData[id | SLAB | j << 10] = block
				}
			}
			const stairBlock = new BlockData(baseBlock, id | STAIR, true)
			stairBlock.transparent = true
			stairBlock.name += " Stairs"
			stairBlock.shape = shapes.stair
			stairBlock.rotate = true
			stairBlock.flip = true
			blockData[id | STAIR] = stairBlock
			v = stairBlock.shape.variants
			for (let j = 1; j < v.length; j++) {
				if (v[j]) {
					let block = new BlockData(stairBlock, id | STAIR | j << 10, false)
					block.shape = v[j]
					blockData[id | STAIR | j << 10] = block
				}
			}
		}
		const v = baseBlock.shape.variants
		if (baseBlock.rotate) {
			const [ny, py, pz, nz, px, nx] = baseBlock.textures
			const orders = [
				[ny, py, nz, pz, nx, px],
				[ny, py, nx, px, pz, nz],
				[ny, py, px, nx, nz, pz],
			]
			for (let j = 2; j < v.length; j += 2) {
				if (v[j]) {
					let block = new BlockData(baseBlock, id | j << 10, false)
					block.shape = v[j]
					block.textures = orders[j / 2 - 1]
					blockData[id | j << 10] = block
				}
			}
		}
		if (baseBlock.flip) {
			for (let j = 1; j < v.length; j += 2) {
				if (v[j]) {
					let block = new BlockData(baseBlock, id | j << 10, false)
					block.shape = v[j]
					block.textures = v[j-1].textures || block.textures
					blockData[id | j << 10] = block
				}
			}
		}
	}
}

const genIcons = () => {
	let gl = state.gl, glCache = state.glCache
	let start = Date.now()
	let shadows = [1, 1, 0.4, 0.4, 0.7, 0.7]
	use2d()
	gl.depthFunc(gl.LESS)
	gl.uniform1i(glCache.uSampler2, 0)
	const limitX = gl.canvas.width >> 6
	const limitY = gl.canvas.height >> 6
	const limit = limitX * limitY
	const total = (BLOCK_COUNT - 1) * 3
	const pages = Math.ceil(total / limit)
	let masks = [CUBE, SLAB, STAIR]
	let drawn = 1

	const mat = new Matrix()
	mat.identity()
	mat.scale(70 / state.width, 70 / state.height, -1)
	mat.rotX(Math.PI / 4)
	mat.rotY(Math.PI / 4)
	mat.transpose()
	gl.uniformMatrix4fv(gl.getUniformLocation(state.program2D, "uView"), false, mat.elements)

	for (let i = 0; i < pages; i++) {
		let blocksPerPage = (limit / 3 | 0) * 3
		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
		let pageStart = drawn
		for (let j = 0; j < blocksPerPage; j += 3) {
			for (let k = 0; k < 3; k++) {
				const id = drawn | masks[k]
				if (blockData[id]?.iconImg) {
					const x = ((j + k) % limitX * 128 + 64) / state.width - 1
					const y = 1 - (((j + k) / limitX | 0) * 128 + 64) / state.height
					gl.uniform2f(glCache.uOffset, x, y)
					const shape = blockData[id].shape === shapes.fence ? shapes.fence.variants[3] : blockData[id].shape
					gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer)
					gl.vertexAttribPointer(glCache.aVertex2, 3, gl.FLOAT, false, 12, 0)
					const texture = []
					const shade = []
					for (let i2 = 0; i2 < shape.texVerts.length; i2++) {
						for (let j2 = 0; j2 < shape.texVerts[i2].length; j2++) {
							for (let k2 = 0; k2 < 8; k2++) {
								texture.push(shape.texVerts[i2][j2][k2] + blockData[id].textures[i2][k2 & 1])
							}
							shade.push(shadows[i2], shadows[i2], shadows[i2], shadows[i2])
						}
					}
					const texBuffer = gl.createBuffer()
					gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer)
					gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture), gl.STATIC_DRAW)
					gl.vertexAttribPointer(glCache.aTexture2, 2, gl.FLOAT, false, 8, 0)
					const shadeBuffer = gl.createBuffer()
					gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer)
					gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shade), gl.STATIC_DRAW)
					gl.vertexAttribPointer(glCache.aShadow2, 1, gl.FLOAT, false, 4, 0)
					if (shape === shapes.lantern || shape === shapes.flower) {
						mat.transpose(); mat.scale(2); mat.transpose()
						gl.uniformMatrix4fv(gl.getUniformLocation(state.program2D, "uView"), false, mat.elements)
					}
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer)
					gl.drawElements(gl.TRIANGLES, 6 * shade.length / 4, gl.UNSIGNED_INT, 0)
					gl.deleteBuffer(shadeBuffer)
					gl.deleteBuffer(texBuffer)
					if (shape === shapes.lantern || shape === shapes.flower) {
						mat.transpose(); mat.scale(1/2); mat.transpose()
						gl.uniformMatrix4fv(gl.getUniformLocation(state.program2D, "uView"), false, mat.elements)
					}
				}
			}
			drawn++
			if (drawn === BLOCK_COUNT) { blocksPerPage = j + 3; break }
		}
		state.ctx.clearRect(0, 0, state.width, state.height)
		state.ctx.drawImage(gl.canvas, 0, 0)
		for (let j = 0; j < blocksPerPage; j += 3) {
			for (let k = 0; k < 3; k++) {
				let id = pageStart + j/3 | masks[k]
				if (blockData[id]?.iconImg) {
					const x = (j + k) % limitX
					const y = (j + k) / limitX | 0
					const c = blockData[id].iconImg.getContext("2d")
					c.drawImage(state.ctx.canvas, x * 64, y * 64, 64, 64, 0, 0, 64, 64)
				}
			}
		}
	}
	console.log("Block icons drawn and extracted in:", Date.now() - start, "ms")
}

const initModelView = (camera) => {
	if (camera) {
		camera.transform()
		camera.getMatrix()
		let gl = state.gl
		gl.useProgram(state.program3DFogless)
		gl.uniformMatrix4fv(state.glCache.uViewFogless, false, state.matrix)
		gl.useProgram(state.program3D)
		gl.uniformMatrix4fv(state.glCache.uView, false, state.matrix)
	}
}

const drawHitbox = (camera) => {
	let gl = state.gl, glCache = state.glCache
	const [x, y, z] = state.hitBox.pos
	camera.transformation.translate(x, y, z)
	gl.useProgram(state.program3DFogless)
	gl.uniformMatrix4fv(glCache.uViewFogless, false, camera.getMatrix())
	camera.transformation.translate(-x, -y, -z)
	gl.bindBuffer(gl.ARRAY_BUFFER, state.hitBox.buffer)
	gl.vertexAttribPointer(glCache.aTexture, 2, gl.FLOAT, false, 0, 0)
	gl.bindBuffer(gl.ARRAY_BUFFER, state.hitBox.shape.buffer)
	gl.vertexAttribPointer(glCache.aVertex, 3, gl.FLOAT, false, 0, 0)
	gl.disableVertexAttribArray(glCache.aSkylight)
	gl.disableVertexAttribArray(glCache.aBlocklight)
	gl.disableVertexAttribArray(glCache.aShadow)
	gl.uniform1f(glCache.uZoffset, -0.0005)
	for (let i = 0; i < state.hitBox.shape.size; i++) {
		gl.drawArrays(gl.LINE_LOOP, i * 4, 4)
	}
	gl.uniform1f(glCache.uZoffset, 0)
}

const initWebgl = (vertexShaderSrc3D, fragmentShaderSrc3D, foglessVertexShaderSrc3D, foglessFragmentShaderSrc3D, vertexShaderSrc2D, fragmentShaderSrc2D, vertexShaderSrcEntity, fragmentShaderSrcEntity) => {
	const win = state.win
	let gl, glCache, glExtensions

	if (!win.gl) {
		let canv = document.getElementById("webgl-canvas")
		canv.width = state.ctx.canvas.width
		canv.height = state.ctx.canvas.height
		win.gl = gl = canv.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false })
		if (!gl) {
			alert("Error: WebGL not detected. Please enable WebGL and/or \"hardware acceleration\" in your browser settings.")
			throw "Error: Cannot play a WebGL game without WebGL."
		}
		win.glExtensions = glExtensions = {
			"vertex_array_object": gl.getExtension("OES_vertex_array_object"),
			"element_index_uint": gl.getExtension("OES_element_index_uint")
		}
		if (!glExtensions.element_index_uint || !glExtensions.vertex_array_object) {
			alert("Unable to load WebGL extension. Please use a supported browser, or update your current browser.")
		}
		gl.viewport(0, 0, canv.width, canv.height)
		gl.enable(gl.DEPTH_TEST)
		gl.enable(gl.BLEND)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

		win.glCache = glCache = {}
		state.program3DFogless = createProgramObject(gl, foglessVertexShaderSrc3D, foglessFragmentShaderSrc3D)
		state.program3D = createProgramObject(gl, vertexShaderSrc3D, fragmentShaderSrc3D)
		state.program2D = createProgramObject(gl, vertexShaderSrc2D, fragmentShaderSrc2D)
		state.programEntity = createProgramObject(gl, vertexShaderSrcEntity, fragmentShaderSrcEntity)
		state.skybox = getSkybox(gl, glCache, state.program3D, state.program3DFogless)

		gl.useProgram(state.program2D)
		glCache.uOffset = gl.getUniformLocation(state.program2D, "uOffset")
		glCache.uSampler2 = gl.getUniformLocation(state.program2D, "uSampler")
		glCache.aTexture2 = gl.getAttribLocation(state.program2D, "aTexture")
		glCache.aVertex2 = gl.getAttribLocation(state.program2D, "aVertex")
		glCache.aShadow2 = gl.getAttribLocation(state.program2D, "aShadow")

		gl.useProgram(state.programEntity)
		glCache.uSamplerEntity = gl.getUniformLocation(state.programEntity, "uSampler")
		glCache.uLightLevelEntity = gl.getUniformLocation(state.programEntity, "uLightLevel")
		glCache.uViewEntity = gl.getUniformLocation(state.programEntity, "uView")
		glCache.aTextureEntity = gl.getAttribLocation(state.programEntity, "aTexture")
		glCache.aVertexEntity = gl.getAttribLocation(state.programEntity, "aVertex")

		gl.useProgram(state.program3DFogless)
		glCache.uViewFogless = gl.getUniformLocation(state.program3DFogless, "uView")
		glCache.uSamplerFogless = gl.getUniformLocation(state.program3DFogless, "uSampler")
		glCache.uPosFogless = gl.getUniformLocation(state.program3DFogless, "uPos")
		glCache.uTimeFogless = gl.getUniformLocation(state.program3DFogless, "uTime")
		glCache.uTransFogless = gl.getUniformLocation(state.program3DFogless, "uTrans")
		glCache.uLanternFogless = gl.getUniformLocation(state.program3DFogless, "uLantern")
		glCache.uZoffset = gl.getUniformLocation(state.program3DFogless, "uZoffset")

		gl.useProgram(state.program3D)
		glCache.uView = gl.getUniformLocation(state.program3D, "uView")
		glCache.uSampler = gl.getUniformLocation(state.program3D, "uSampler")
		glCache.uPos = gl.getUniformLocation(state.program3D, "uPos")
		glCache.uDist = gl.getUniformLocation(state.program3D, "uDist")
		glCache.uTime = gl.getUniformLocation(state.program3D, "uTime")
		glCache.uSky = gl.getUniformLocation(state.program3D, "uSky")
		glCache.uSun = gl.getUniformLocation(state.program3D, "uSun")
		glCache.uTrans = gl.getUniformLocation(state.program3D, "uTrans")
		glCache.uLantern = gl.getUniformLocation(state.program3D, "uLantern")
		glCache.aShadow = gl.getAttribLocation(state.program3D, "aShadow")
		glCache.aSkylight = gl.getAttribLocation(state.program3D, "aSkylight")
		glCache.aBlocklight = gl.getAttribLocation(state.program3D, "aBlocklight")
		glCache.aTexture = gl.getAttribLocation(state.program3D, "aTexture")
		glCache.aVertex = gl.getAttribLocation(state.program3D, "aVertex")

		win.glPrograms = { program2D: state.program2D, program3D: state.program3D, program3DFogless: state.program3DFogless, programEntity: state.programEntity, skybox: state.skybox }
	}
	else {
		gl = win.gl; glCache = win.glCache; glExtensions = win.glExtensions
		let progs = win.glPrograms
		state.program2D = progs.program2D
		state.program3D = progs.program3D
		state.program3DFogless = progs.program3DFogless
		state.programEntity = progs.programEntity
		state.skybox = progs.skybox
		document.getElementById("webgl-canvas").remove()
		document.body.prepend(gl.canvas)
		gl.useProgram(state.program3D)
	}

	state.gl = gl
	state.glCache = glCache
	state.glExtensions = glExtensions

	gl.uniform1f(glCache.uDist, 1000)
	gl.uniform1i(glCache.uTrans, 0)

	initTextures(gl, glCache)
	initShapes()

	state.hitBox.buffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, state.hitBox.buffer)
	gl.bufferData(gl.ARRAY_BUFFER, hitboxTextureCoords, gl.STATIC_DRAW)

	let indexOrder = new Uint32Array(state.bigArray.length / 6 | 0)
	for (let i = 0, j = 0; i < indexOrder.length; i += 6, j += 4) {
		indexOrder[i] = j; indexOrder[i+1] = 1+j; indexOrder[i+2] = 2+j
		indexOrder[i+3] = j; indexOrder[i+4] = 2+j; indexOrder[i+5] = 3+j
	}
	state.indexBuffer = gl.createBuffer()
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer)
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexOrder, gl.STATIC_DRAW)

	gl.enable(gl.CULL_FACE)
	gl.cullFace(gl.BACK)
	gl.depthRange(0, 2)
	gl.lineWidth(2)
	gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
}

export { use2d, use3d, dirt, initDirt, initShapes, genIcons, initModelView, drawHitbox, initWebgl, animateTextures }
