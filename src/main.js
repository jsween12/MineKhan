import './index.css'

// GLSL Shader code
import vertexShaderSrc3D from './shaders/blockVert.glsl'
import fragmentShaderSrc3D from './shaders/blockFrag.glsl'
import foglessVertexShaderSrc3D from './shaders/blockVertFogless.glsl'
import foglessFragmentShaderSrc3D from './shaders/blockFragFogless.glsl'
import vertexShaderSrc2D from './shaders/2dVert.glsl'
import fragmentShaderSrc2D from './shaders/2dFrag.glsl'
import vertexShaderSrcEntity from './shaders/entityVert.glsl'
import fragmentShaderSrcEntity from './shaders/entityFrag.glsl'

// WebWorker code (loaded as text)
import workerCode from './workers/Caves.js'

// Core modules
import { state, fill, textSize } from './js/state.js'
import { randomSeed } from './js/random.js'
import { PVector } from './js/3Dutils.js'
import { blockData } from './js/blockData.js'
import { compressString } from './js/utils.js'
import { inventory } from './js/inventory.js'
import { shapes } from './js/shapes.js'
import { Camera } from './js/camera.js'
import { initWorkers } from './js/workers.js'
import { initWebgl, genIcons, initDirt, use3d, dirt } from './js/renderer.js'
import { resolveContactsAndUpdatePosition, runGravity, controls } from './js/physics.js'
import { initControls, initEventHandlers, setControl } from './js/input.js'
import { initCommands, initMultiplayer } from './js/multiplayer.js'
import { initButtons, initWorldsMenu } from './js/ui/menus.js'
import { Button } from './js/ui/button.js'
import { Slider } from './js/ui/slider.js'
import { changeScene, play, initDrawScreens } from './js/ui/screens.js'
import { hud } from './js/ui/hud.js'
import { changelog } from './js/changelog.js'

const win = state.win
const MineKhan = async () => {
	const { Math, performance, Date, document } = window
	const { round, min, max } = Math
	let now = Date.now()

	win.blockData = blockData
	win.savebox = document.getElementById("savebox")
	win.boxCenterTop = document.getElementById("boxcentertop")
	win.saveDirections = document.getElementById("savedirections")
	win.message = document.getElementById("message")
	win.worlds = document.getElementById("worlds")
	win.quota = document.getElementById("quota")
	win.hoverbox = document.getElementById("onhover")

	const { savebox, boxCenterTop, saveDirections, message, quota, hoverbox, loadString } = win

	// Set up canvas
	const canvas = document.getElementById("overlay")
	canvas.width = win.innerWidth
	canvas.height = win.innerHeight
	const ctx = canvas.getContext("2d")
	win.canvas = canvas

	// Assign to shared state
	state.canvas = canvas
	state.ctx = ctx
	state.now = now

	// Override native prototypes (for save compatibility)
	String.prototype.hashCode = function() {
		var hash = 0, i, chr
		if (this.length === 0) return hash
		for (i = 0; i < this.length; i++) {
			chr = this.charCodeAt(i)
			hash = (hash << 5) - hash + chr
			hash |= 0
		}
		return hash
	}
	Uint8Array.prototype.toString = function() {
		let str = ""
		for (let i = 0; i < this.length; i++) str += String.fromCharCode(this[i])
		return compressString(btoa(str))
	}

	// Initialize shared vectors
	state.vec1 = new PVector()
	state.vec2 = new PVector()
	state.vec3 = new PVector()

	randomSeed(Math.random() * 10000000 | 0)

	// Initialize workers
	initWorkers(workerCode)

	// Initialize HTML scene data
	state.html = {
		play: { enter: [document.getElementById("hotbar")], exit: [document.getElementById("hotbar")] },
		pause: { enter: [win.message], exit: [win.savebox, win.saveDirections, win.message] },
		"main menu": {
			onenter: () => { canvas.style.backgroundImage = background },
			onexit: () => { canvas.style.backgroundImage = ""; dirt() }
		},
		"loadsave menu": {
			enter: [win.worlds, win.boxCenterTop, quota],
			exit: [win.worlds, win.boxCenterTop, quota],
			onenter: () => {
				win.boxCenterTop.placeholder = "Enter Save String (Optional)"
				if (navigator?.storage?.estimate) {
					navigator.storage.estimate().then(data => {
						quota.innerText = `${data.usage.toLocaleString()} / ${data.quota.toLocaleString()} bytes (${(100 * data.usage / data.quota).toLocaleString(undefined, { maximumSignificantDigits: 2 })}%) of your quota used`
					}).catch(console.error)
				}
				win.boxCenterTop.onmousedown = () => {
					let elem = document.getElementsByClassName("selected")
					if (elem && elem[0]) elem[0].classList.remove("selected")
					state.selectedWorld = 0; Button.draw()
				}
			},
			onexit: () => { win.boxCenterTop.onmousedown = null }
		},
		"creation menu": {
			enter: [win.boxCenterTop], exit: [win.boxCenterTop],
			onenter: () => { win.boxCenterTop.placeholder = "Enter World Name"; win.boxCenterTop.value = "" }
		},
		loading: {
			enter: [document.getElementById("loading-text")],
			exit: [document.getElementById("loading-text")],
			onenter: () => { dirt(); state.world.loadChunks() }
		},
		editworld: {
			enter: [win.boxCenterTop], exit: [win.boxCenterTop],
			onenter: () => { win.boxCenterTop.placeholder = "Enter World Name"; win.boxCenterTop.value = "" }
		},
		"multiplayer menu": { enter: [win.worlds], exit: [win.worlds] },
		chat: {
			enter: [document.getElementById("chatbar"), document.getElementById("chat")],
			exit: [document.getElementById("chatbar"), document.getElementById("chat")],
			onenter: () => {
				document.getElementById("chatbar").focus()
				document.exitPointerLock?.()
				document.getElementById("chat").scroll(0, 10000000)
			}
		},
		inventory: {
			enter: [document.getElementById('inv-container')],
			exit: [document.getElementById('inv-container'), hoverbox, document.getElementById('heldItem')],
			onenter: () => { 
				console.log("[INV] Inventory screen onenter called")
				ctx.clearRect(0, 0, state.width, state.height); 
				inventory.playerStorage.render() 
			}
		},
		controls: { enter: [document.getElementById("controls-container")], exit: [document.getElementById("controls-container")] },
		changelog: { enter: [changelog], exit: [changelog] }
	}

	// Background image
	let background = "url(./background.webp)"
	if (location.origin === "https://www.kasandbox.org") background = "url(https://www.khanacademy.org/computer-programming/minekhan/5647155001376768/latest.png)"
	else if (!location.origin.includes("localhost") && location.origin !== "file://") background = "url(https://willard.fun/minekhan/background.webp)"
	canvas.style.backgroundImage = background

	// Initialize controls
	initControls()

	// Initialize screen draw functions
	initDrawScreens(dirt)

	// Determine monospace character width
	let span = document.createElement('span')
	span.style.fontFamily = "monospace"
	span.style.fontSize = "20px"
	span.textContent = "a"
	document.body.append(span)
	state.charWidth = span.offsetWidth
	span.remove()

	win.shapes = shapes
	win.blockIds = blockData

	// Initialize commands
	initCommands()

	// Initialize player
	const initPlayer = () => {
		let p = new Camera()
		p.speed = 0.11
		p.velocity = new PVector(0, 0, 0)
		p.sprintSpeed = 1.5
		p.flySpeed = 3.75
		p.x = 8; p.y = 0; p.z = 8
		p.w = 6 / 16
		p.bottomH = 1.62; p.topH = 0.18
		p.onGround = false; p.jumpSpeed = 0.45
		p.sprinting = false; p.maxYVelocity = 4.5
		p.gravityStrength = -0.091
		p.lastUpdate = performance.now()
		p.lastBreak = now; p.lastPlace = now; p.lastJump = now
		p.autoBreak = false; p.autoBuild = false
		p.flying = false; p.sneaking = false; p.spectator = false
		const { roundBits } = window.parent.exports["src/js/utils.js"]
		p.minX = () => roundBits(p.x - p.w - state.p2.x)
		p.minY = () => roundBits(p.y - p.bottomH - state.p2.y)
		p.minZ = () => roundBits(p.z - p.w - state.p2.z)
		p.maxX = () => roundBits(p.x + p.w - state.p2.x)
		p.maxY = () => roundBits(p.y + p.topH - state.p2.y)
		p.maxZ = () => roundBits(p.z + p.w - state.p2.z)
		state.p = p
		win.player = p
		win.p2 = state.p2
	}

	const initEverything = () => {
		state.generatedChunks = 0
		initPlayer()
		initWebgl(vertexShaderSrc3D, fragmentShaderSrc3D, foglessVertexShaderSrc3D, foglessFragmentShaderSrc3D, vertexShaderSrc2D, fragmentShaderSrc2D, vertexShaderSrcEntity, fragmentShaderSrcEntity)
		genIcons()
		initDirt()
		state.drawScreens[state.screen]()
		state.p.FOV(state.settings.fov)
		inventory.size = min(state.width, state.height) / 15 | 0
		inventory.init(true)
		initWorldsMenu().then(() => { initButtons(); Button.draw(); Slider.draw() })

		// Check for multiplayer link
		var urlParams = new URLSearchParams(win.location.search)
		if (urlParams.has("target")) { changeScene("multiplayer menu"); initMultiplayer(urlParams.get("target")) }

		// Initialize event handlers
		initEventHandlers()

		if (win.tickid) win.clearInterval(win.tickid)
		win.tickid = setInterval(tickLoop, 50)
	}

	// Font loading delay
	setTimeout(() => {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/b825b088-9c26-46f3-b34c-081d6bb355cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:231',message:'Initial screen render',data:{screen:state.screen,hasDrawScreen:!!state.drawScreens[state.screen],buttonCount:Button.all?.length},timestamp:Date.now(),runId:'menu-debug',hypothesisId:'menu'})}).catch(()=>{});
		// #endregion
		state.drawScreens[state.screen](); Button.draw(); Slider.draw()
	}, 100)

	const tickLoop = () => {
		if (state.world && state.screen === "play") {
			let tickStart = performance.now()
			state.world.tick()
			state.analytics.ticks++
			state.analytics.totalTickTime += performance.now() - tickStart
			controls()
			runGravity()
			resolveContactsAndUpdatePosition()
		}
	}

	let prevTime = 0
	const renderLoop = (time) => {
		let frameFPS = Math.round(10000 / (time - prevTime)) / 10
		prevTime = time

		if (!state.gl && window.innerWidth && window.innerHeight) initEverything()

		state.now = Date.now()
		let frameStart = performance.now()

		if (state.screen === "play" || state.screen === "loading") {
			try { state.drawScreens[state.screen]() }
			catch(e) { console.error(e) }
		}

		if (state.screen === "play" && state.now - state.analytics.lastUpdate > 500 && state.analytics.frames) {
			state.analytics.displayedTickTime = (state.analytics.totalTickTime / state.analytics.ticks).toFixed(1)
			state.analytics.displayedRenderTime = (state.analytics.totalRenderTime / state.analytics.frames).toFixed(1)
			state.analytics.displayedFrameTime = (state.analytics.totalFrameTime / state.analytics.frames).toFixed(1)
			state.analytics.fps = round(state.analytics.frames * 1000 / (state.now - state.analytics.lastUpdate))
			state.analytics.displayedwFrameTime = state.analytics.worstFrameTime.toFixed(1)
			state.analytics.displayedwFps = state.analytics.worstFps
			state.analytics.worstFps = 1000000
			state.analytics.frames = 0
			state.analytics.totalRenderTime = 0
			state.analytics.totalTickTime = 0
			state.analytics.ticks = 0
			state.analytics.totalFrameTime = 0
			state.analytics.worstFrameTime = 0
			state.analytics.lastUpdate = state.now
			hud()
		}

		state.analytics.frames++
		state.analytics.totalFrameTime += performance.now() - frameStart
		state.analytics.worstFrameTime = max(performance.now() - frameStart, state.analytics.worstFrameTime)
		state.analytics.worstFps = min(frameFPS, state.analytics.worstFps)
		win.raf = requestAnimationFrame(renderLoop)
	}
	return renderLoop
}

;(async function() {
	if (win.raf) {
		win.cancelAnimationFrame(win.raf)
		console.log("Canceled", win.raf)
	}
	var init = await MineKhan()
	init()
})()
