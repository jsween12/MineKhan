// menus.js - Button/slider initialization, world selection menus, multiplayer menu
import { state, fill, text, textSize, sleep } from '../state.js'
import { Button } from './button.js'
import { Slider } from './slider.js'
import { changeScene, play, save } from './screens.js'
import { inventory, InventoryItem } from '../inventory.js'
import { blockData, blockIds } from '../blockData.js'
import { saveToDB, loadFromDB, deleteFromDB } from '../indexDB.js'
import { timeString, decompressString } from '../utils.js'
import { initMultiplayer, getWorlds } from '../multiplayer.js'
import { World, sortChunks } from '../world.js'
import { setControl } from '../input.js'
import { changelog } from '../changelog.js'
import { spawnNPC, deleteNPC, setNPCState } from '../skinnedPlayer.js'

const { round, min } = Math

const sanitize = (text) => {
	const el = document.createElement('div')
	el.textContent = text
	return el.innerHTML
}

const initButtons = () => {
	Button.all = []; Slider.all = []
	const nothing = () => false; const always = () => true
	let survival = false
	let w = state.width, h = state.height

	// Main menu
	Button.add(w/2, h/2-20, 400, 40, "Singleplayer", "main menu", () => { initWorldsMenu(); changeScene("loadsave menu") })
	Button.add(w/2, h/2+35, 400, 40, "Multiplayer", "main menu", () => { changeScene("multiplayer menu"); initMultiplayerMenu() }, () => !location.href.startsWith("https://willard.fun"), "Please visit https://willard.fun/login to enjoy multiplayer.")
	Button.add(w/2, h/2+90, 400, 40, "Options", "main menu", () => changeScene("options"))
	Button.add(w/2, h/2+145, 400, 40, "Change Log" + (state.settings.lastVersion !== state.version ? " (NEW UPDATE!)" : ""), "main menu", () => {
		changeScene("changelog")
		if (state.settings.lastVersion !== state.version) { state.settings.lastVersion = state.version; saveToDB("settings", state.settings).catch(e => console.error(e)) }
	})
	if (h <= 600) { Button.add(w/2, h/2+200, 400, 40, "Full Screen", "main menu", () => { const w2 = window.open(); w2.document.write(document.children[0].outerHTML) }) }

	// Creation menu
	Button.add(w/2, 135, 300, 40, ["World Type: Normal", "World Type: Superflat"], "creation menu", r => state.superflat = r === "World Type: Superflat")
	Button.add(w/2, 185, 300, 40, ["Terrain Details: On", "Terrain Details: Off"], "creation menu", r => state.details = r === "Terrain Details: On", function() { if (state.superflat) { this.index = 1; state.details = false }; return state.superflat })
	Button.add(w/2, 235, 300, 40, ["Caves: On", "Caves: Off"], "creation menu", r => state.caves = r === "Caves: On", function() { if (state.superflat) { this.index = 1; state.caves = false }; return state.superflat })
	Button.add(w/2, 285, 300, 40, ["Game Mode: Creative", "Game Mode: Survival"], "creation menu", r => survival = r === "Game Mode: Survival")
	Button.add(w/2, 335, 300, 40, "Difficulty: Peaceful", "creation menu", nothing, always, "Ender dragon blocks? Maybe?")
	Button.add(w/2, h-90, 300, 40, "Create New World", "creation menu", () => {
		if (survival) { alert("Survival Soon™"); return }
		state.world = new World()
		state.world.id = "" + state.now + (Math.random() * 1000000 | 0)
		let name = state.win.boxCenterTop.value || "World"; let number = ""; let naming = true
		while (naming) {
			let match = false
			for (let id in state.worlds) { if (state.worlds[id].name === name + number) { match = true; break } }
			if (match) number = number ? number + 1 : 1
			else { name = name + number; naming = false }
		}
		state.world.name = name; state.win.world = state.world
		state.world.loadChunks(); state.world.chunkGenQueue.sort(sortChunks)
		changeScene("loading")
	})
	Button.add(w/2, h-40, 300, 40, "Cancel", "creation menu", () => changeScene("back"))

	// Loadsave menu
	const selected = () => !state.selectedWorld || !state.worlds[state.selectedWorld]
	let w4 = min(w/4-10, 220), x4 = w4/2+5, w2 = min(w/2-10, 450), x2 = w2/2+5, mid = w/2
	Button.add(mid-3*x4, h-30, w4, 40, "Edit", "loadsave menu", () => changeScene("editworld"), () => selected() || !state.worlds[state.selectedWorld].edited)
	Button.add(mid-x4, h-30, w4, 40, "Delete", "loadsave menu", () => {
		const cloud = location.href.startsWith("https://willard.fun/") ? " This will also delete it from the cloud." : ""
		if (state.worlds[state.selectedWorld] && confirm(`Are you sure you want to delete ${state.worlds[state.selectedWorld].name}?${cloud}`)) {
			deleteFromDB(state.selectedWorld)
			state.win.worlds.removeChild(document.getElementById(state.selectedWorld))
			delete state.worlds[state.selectedWorld]
			if (cloud) fetch(`https://willard.fun/minekhan/saves/${state.selectedWorld}`, { method: "DELETE" })
			state.selectedWorld = 0
		}
	}, () => selected() || !state.worlds[state.selectedWorld].edited, "Delete the world forever.")
	Button.add(mid+x4, h-30, w4, 40, "Export", "loadsave menu", () => { state.win.boxCenterTop.value = state.worlds[state.selectedWorld].code }, selected, "Export save code.")
	Button.add(mid+3*x4, h-30, w4, 40, "Cancel", "loadsave menu", () => changeScene("main menu"))
	Button.add(mid-x2, h-75, w2, 40, "Play Selected World", "loadsave menu", async () => {
		state.world = new World(true); state.win.world = state.world
		let code
		if (!state.selectedWorld) { code = state.win.boxCenterTop.value }
		else {
			let data = state.worlds[state.selectedWorld]
			if (data) {
				state.world.id = data.id; state.world.edited = data.edited
				if (data.code) code = data.code
				else { code = await fetch(`https://willard.fun/minekhan/saves/${state.selectedWorld}`).then(res => res.headers.get("content-type") === "application/octet-stream" ? res.arrayBuffer().then(a => new Uint8Array(a)) : res.text()) }
			}
		}
		if (code) {
			try { state.world.loadSave(code); state.world.id = state.world.id || "" + state.now + (Math.random() * 1000000 | 0) }
			catch(e) { alert("Unable to load save"); return }
			changeScene("loading")
		}
	}, () => !(!state.selectedWorld && state.win.boxCenterTop.value) && !state.worlds[state.selectedWorld])
	Button.add(mid+x2, h-75, w2, 40, "Create New World", "loadsave menu", () => changeScene("creation menu"))
	Button.add(mid, h/2, w2, 40, "Save", "editworld", () => {
		let wd = state.worlds[state.selectedWorld]
		if (typeof wd.code === "string") { wd.name = state.win.boxCenterTop.value.replace(/;/g, "\u037e"); let split = wd.code.split(";"); split[0] = wd.name; wd.code = split.join(";") }
		else {
			let oldLength = wd.name.length; wd.name = state.win.boxCenterTop.value.slice(0, 256) || wd.name; let newLength = wd.name.length
			let newCode = new Uint8Array(wd.code.length + newLength - oldLength); newCode[0] = newLength
			for (let i = 0; i < newLength; i++) newCode[i + 1] = wd.name.charCodeAt(i) & 255
			let newIndex = newLength + 1; let oldIndex = oldLength + 1
			while (newIndex < newCode.length) newCode[newIndex++] = wd.code[oldIndex++]
			wd.code = newCode
		}
		saveToDB(wd.id, wd).then(() => { initWorldsMenu(); changeScene("loadsave menu") }).catch(e => console.error(e))
	})
	Button.add(mid, h/2+50, w2, 40, "Back", "editworld", () => changeScene("back"))

	// Pause
	Button.add(w/2, 225, 300, 40, "Resume", "pause", play)
	Button.add(w/2, 275, 300, 40, "Options", "pause", () => changeScene("options"))
	Button.add(w/2, 325, 300, 40, "Save", "pause", save, () => !!state.multiplayer && !state.multiplayer.host, () => {
		const account = location.href.startsWith("https://willard.fun") ? " + account" : ""
		return `Save the world to your browser${account}.\n\nLast saved ${timeString(state.now - state.world.edited)}.`
	})
	Button.add(w/2, 375, 300, 40, "Get Save Code", "pause", () => { state.win.savebox.classList.remove("hidden"); state.win.saveDirections.classList.remove("hidden"); state.win.savebox.value = state.world.getSaveString() })
	Button.add(w/2, 425, 300, 40, "Open World To Public", "pause", () => initMultiplayer(), () => !!state.multiplayer || !location.href.startsWith("https://willard.fun"))
	Button.add(w/2, 475, 300, 40, "Exit Without Saving", "pause", () => { if (state.multiplayer) state.multiplayer.close(); initWorldsMenu(); changeScene("main menu"); state.world.unloadChunks(); state.world = null })

	// Coming soon
	Button.add(w/2, 395, w/3, 40, "Back", "comingsoon menu", () => changeScene("back"))

	// Multiplayer
	Button.add(mid+3*x4, h-30, w4, 40, "Cancel", "multiplayer menu", () => changeScene("main menu"))
	Button.add(mid-x2, h-75, w2, 40, "Play Selected World", "multiplayer menu", () => { state.win.world = null; if (state.selectedWorld) initMultiplayer(state.selectedWorld) }, () => !state.selectedWorld)

	// Options
	const optionsBottom = h >= 550 ? 500 : h - 50
	Button.add(w/2, optionsBottom-60*5, w/3, 40, "Controls", "options", () => changeScene("controls"))
	Slider.add(w/2, optionsBottom-60*4, w/3, 40, "options", "Render Distance", 1, 32, "renderDistance", val => state.settings.renderDistance = round(val))
	Slider.add(w/2, optionsBottom-60*3, w/3, 40, "options", "FOV", 30, 110, "fov", val => { state.p.FOV(val); if (state.world) { state.p.setDirection(); state.world.render() } })
	Slider.add(w/2, optionsBottom-60*2, w/3, 40, "options", "Mouse Sensitivity", 30, 400, "mouseSense", val => state.settings.mouseSense = val)
	Slider.add(w/2, optionsBottom-60, w/3, 40, "options", "Reach", 5, 100, "reach", val => state.settings.reach = val)
	Button.add(w/2, optionsBottom, w/3, 40, "Back", "options", () => changeScene("back"))
	Button.add(w/2, 60, w/3, 40, "Back", "controls", () => changeScene("back"))
	Button.add(w/2, 60, w/3, 40, "Back", "changelog", () => changeScene("back"))

	// NPC menu buttons
	const npcScene = "npc menu"
	const noNPC = () => !state.npc
	const hasNPC = () => !!state.npc

	Button.add(w/2, h/2-100, 300, 40, "Spawn NPC", npcScene, () => { spawnNPC(state.world); play() }, hasNPC, "Spawn an NPC in front of you")
	Button.add(w/2, h/2-50, 300, 40, () => "Idle" + (state.npc?.aiState === "idle" ? " [active]" : ""), npcScene, () => { setNPCState("idle"); play() }, noNPC)
	Button.add(w/2, h/2, 300, 40, () => "Wander" + (state.npc?.aiState === "wander" ? " [active]" : ""), npcScene, () => { setNPCState("wander"); play() }, noNPC)
	Button.add(w/2, h/2+50, 300, 40, () => "Follow Me" + (state.npc?.aiState === "follow" ? " [active]" : ""), npcScene, () => { setNPCState("follow"); play() }, noNPC)
	Button.add(w/2, h/2+100, 300, 40, "Delete NPC", npcScene, () => { deleteNPC(state.world); play() }, noNPC, "Remove the NPC from the world")
	Button.add(w/2, h/2+160, 300, 40, "Close", npcScene, () => play())
}

const initWorldsMenu = async () => {
	const win = state.win
	while (win.worlds.firstChild) win.worlds.removeChild(win.worlds.firstChild)
	state.selectedWorld = 0; win.boxCenterTop.value = ""
	const deselect = () => { let elem = document.getElementsByClassName("selected"); if (elem && elem[0]) elem[0].classList.remove("selected") }
	const addWorld = (name, version, size, id, edited, cloud) => {
		let div = document.createElement("div"); div.className = "world"
		div.onclick = () => { deselect(); div.classList.add("selected"); state.selectedWorld = id }
		div.id = id
		div.innerHTML = "<strong>" + sanitize(name) + "</strong><br>"
		if (edited) div.innerHTML += new Date(edited).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "<br>"
		div.innerHTML += version + "<br>"
		if (cloud) div.innerHTML += `Cloud Save (${size.toLocaleString()} bytes)`
		else div.innerHTML += `${size.toLocaleString()} bytes used`
		win.worlds.appendChild(div)
	}
	state.worlds = {}
	if (win.loadString) {
		try {
			let tempWorld = new World(true); tempWorld.loadSave(win.loadString)
			addWorld(`${tempWorld.name} (Pre-loaded)`, tempWorld.version, win.loadString.length, state.now)
			state.worlds[state.now] = { code: win.loadString, id: state.now }
		} catch(e) { console.log("Unable to load hardcoded save."); console.error(e) }
	}
	let res = await loadFromDB().catch(console.error)
	if (res && res.length) {
		let index = res.findIndex(obj => obj.id === "settings")
		if (index >= 0) {
			Object.assign(state.settings, res[index].data)
			for (let name in state.settings.controls) setControl(...state.settings.controls[name])
			state.p.FOV(state.settings.fov); res.splice(index, 1)
		}
	}
	if (res && res.length) {
		res = res.map(d => d.data).filter(d => d && d.code).sort((a, b) => b.edited - a.edited)
		for (let data of res) { addWorld(data.name, data.version, data.code.length + 60, data.id, data.edited, false); data.cloud = false; state.worlds[data.id] = data }
	}
	if (location.href.startsWith("https://willard.fun/")) {
		let cloudSaves = await fetch('https://willard.fun/minekhan/saves').then(r => r.json())
		if (Array.isArray(cloudSaves) && cloudSaves.length) {
			for (let data of cloudSaves) {
				if (state.worlds[data.id] && state.worlds[data.id].edited >= data.edited) continue
				addWorld(data.name, data.version, data.size + 60, data.id, data.edited, true); data.cloud = true; state.worlds[data.id] = data
			}
		}
	}
	win.worlds.onclick = Button.draw; win.boxCenterTop.onkeyup = Button.draw
	state.superflat = false; state.details = true; state.caves = true
}

const initMultiplayerMenu = async () => {
	const win = state.win
	while (win.worlds.firstChild) win.worlds.removeChild(win.worlds.firstChild)
	state.selectedWorld = 0; win.boxCenterTop.value = ""
	const deselect = () => { let elem = document.getElementsByClassName("selected"); if (elem && elem[0]) elem[0].classList.remove("selected") }
	let servers = await getWorlds()
	const addWorld = (name, host, online, id, version, password) => {
		let div = document.createElement("div"); div.className = "world"
		div.onclick = () => { deselect(); div.classList.add("selected"); state.selectedWorld = id }
		div.id = id
		div.innerHTML = "<strong>" + sanitize(name) + "</strong><br>Hosted by " + sanitize(host) + "<br>"
		const span = document.createElement("span"); span.className = "online"; span.textContent = online.toString()
		div.appendChild(span)
		div.innerHTML += " players online<br>" + version + "<br>"
		if (password) div.innerHTML += "Password-protected<br>"
		win.worlds.appendChild(div)
	}
	state.worlds = {}
	for (let data of servers) { addWorld(data.name, data.host, data.online, data.target, data.version, !data.public); state.worlds[data.target] = data }
	win.worlds.onclick = Button.draw; win.boxCenterTop.onkeyup = Button.draw
	let refresh = setInterval(async () => {
		if (state.screen !== "multiplayer menu") return clearInterval(refresh)
		let servers = await getWorlds()
		clear: for (let target in state.worlds) { for (let data of servers) if (data.target === target) continue clear; document.getElementById(target).remove(); delete state.worlds[target] }
		for (let data of servers) {
			if (!document.getElementById(data.target)) addWorld(data.name, data.host, data.online, data.target, data.version, !data.public)
			state.worlds[data.target] = data
			const element = document.getElementById(data.target)
			element.getElementsByClassName("online")[0].textContent = data.online.toString()
		}
	}, 5000)
}

export { initButtons, initWorldsMenu, initMultiplayerMenu }
