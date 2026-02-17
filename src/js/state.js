// state.js - Central shared state for the MineKhan application.
// All modules import this to share mutable state without circular dependencies.

const win = window.parent

// Yield thread - pauses current task until the event loop is cleared
let yieldThread
{
	const channel = new MessageChannel()
	let res
	channel.port1.onmessage = () => res()
	yieldThread = () => {
		return new Promise(resolve => {
			res = resolve
			channel.port2.postMessage("")
		})
	}
}

const state = {
	win,

	// Version info
	version: "Alpha 0.8.2",

	// Canvas and 2D drawing context
	canvas: null,
	ctx: null,
	width: win.innerWidth,
	height: win.innerHeight,

	// WebGL state
	gl: null,
	glCache: null,
	glExtensions: null,
	program3D: null,
	program2D: null,
	programEntity: null,
	program3DFogless: null,
	indexBuffer: null,
	dirtBuffer: null,

	// Game objects
	world: null,
	p: null,
	p2: { x: 0, y: 0, z: 0 },
	skybox: null,
	npc: null, // Current skinned NPC entity (single NPC limit)

	// Settings (configurable and savable)
	settings: {
		renderDistance: 4,
		fov: 70,
		mouseSense: 100,
		reach: 5,
		showDebug: 3,
		controls: {},
	},

	// World generation options
	superflat: false,
	details: true,
	caves: true,

	// Screen / scene state
	screen: "main menu",
	screenPath: ["main menu"],
	drawScreens: {
		"main menu": () => {},
		"options": () => {},
		"play": () => {},
		"pause": () => {},
		"creation menu": () => {},
		"inventory": () => {},
		"multiplayer menu": () => {},
		"comingsoon menu": () => {},
		"loadsave menu": () => {},
		"chat": () => {},
		"controls": () => {},
		"changelog": () => {},
		"npc menu": () => {},
	},
	html: {},

	// Input state
	mouseX: 0,
	mouseY: 0,
	mouseDown: false,
	Key: {},
	controlMap: win.controlMap || {},

	// Player interaction
	holding: 0,
	hitBox: {},

	// World selection
	worlds: null,
	selectedWorld: 0,

	// Game timing and state
	freezeFrame: 0,
	maxHeight: 255,
	generatedChunks: 0,
	renderedChunks: 0,
	fogDist: 16,
	now: Date.now(),

	// Movement vector
	move: { x: 0, y: 0, z: 0, ang: Math.sqrt(0.5) },

	// Multiplayer
	multiplayer: null,
	currentUser: { username: "Player" },
	blockLog: { Player: [] },
	playerPositions: {},
	playerEntities: {},
	playerDistances: [],

	// Performance analytics
	analytics: {
		totalTickTime: 0,
		worstFrameTime: 0,
		totalRenderTime: 0,
		totalFrameTime: 0,
		lastUpdate: 0,
		frames: 1,
		ticks: 0,
		displayedTickTime: "0",
		displayedRenderTime: "0",
		displayedFrameTime: "0",
		displayedwFrameTime: "0",
		displayedwFps: 0,
		fps: 0,
		worstFps: 60,
	},

	// Chat state
	alerts: [],
	commands: new Map(),
	autocompleteList: [],
	commandList: [],

	// UI state
	unpauseDelay: 0,
	debugLines: [],
	newDebugLines: [],
	charWidth: 6,

	// Shared buffers
	bigArray: win.bigArray || new Float32Array(1000000),
	matrix: new Float32Array(16),
	defaultTransformation: null,

	// Shared vectors (initialized after PVector is loaded)
	vec1: null,
	vec2: null,
	vec3: null,
}

win.controlMap = state.controlMap
win.bigArray = state.bigArray

// Drawing helpers that reference state.ctx / state.canvas
const fill = (r, g, b) => {
	if (g === undefined) { g = r; b = r }
	state.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
}
const stroke = (r, g, b) => {
	if (g === undefined) { g = r; b = r }
	state.ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
}
const text = (txt, x, y, h) => {
	h = h || 0
	let lines = txt.split("\n")
	for (let i = 0; i < lines.length; i++) {
		state.ctx.fillText(lines[i], x, y + h * i)
	}
}
const textSize = (size) => {
	state.ctx.font = size + 'px Monospace'
}
const strokeWeight = (num) => {
	state.ctx.lineWidth = num
}
const HAND = "pointer"
const cursor = (type) => {
	state.canvas.style.cursor = type
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export { state, fill, stroke, text, textSize, strokeWeight, HAND, cursor, sleep, yieldThread }
