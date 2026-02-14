// multiplayer.js - WebSocket connection, commands, and player sync
import { state, sleep } from './state.js'
import { chat, sendChat, addCommand, setAutocomplete } from './ui/chat.js'
import { changeScene, play } from './ui/screens.js'
import { inventory, InventoryItem } from './inventory.js'
import { blockData, blockIds } from './blockData.js'
import { timeString } from './utils.js'
import { Player } from './player.js'

const { abs, round } = Math

const loggedIn = async () => {
	let exists = await fetch("https://willard.fun/profile").then(res => res.text()).catch(() => "401")
	if (!exists || exists === "401") {
		if (location.href.startsWith("https://willard.fun")) {
			alert("You're not logged in. Head over to https://willard.fun/login to login or register before connecting to the server.")
		} else {
			alert("Multiplayer is currently only available on https://willard.fun/login => https://willard.fun/minekhan")
		}
		return false
	}
	state.currentUser = JSON.parse(exists)
	if (state.blockLog.Player) {
		state.blockLog[state.currentUser.username] = state.blockLog.Player
		delete state.blockLog.Player
	}
	return true
}

const initMultiplayer = async (target) => {
	if (state.multiplayer) return
	let logged = await loggedIn()
	if (!logged) return
	let host = false
	if (!target) { target = state.world.id; host = true }
	state.multiplayer = new WebSocket("wss://willard.fun/ws?target=" + target)
	state.multiplayer.host = host
	state.multiplayer.binaryType = "arraybuffer"
	state.multiplayer.onopen = () => {
		let password = ""
		if (!host && !state.worlds[target].public) password = prompt(`What's the password for ${state.worlds[target].name}?`) || ""
		state.multiplayer.send(JSON.stringify({ type: "connect", password }))
		if (host) {
			let password = prompt("Enter a password to make this a private world, or leave it blank for a public world.") || ""
			state.multiplayer.send(JSON.stringify({ type: "init", name: state.world.name, version: state.version, password }))
		}
		state.multiplayer.pos = setInterval(() => state.multiplayer.send(JSON.stringify({
			type: "pos",
			data: { x: state.p.x, y: state.p.y, z: state.p.z, vx: state.p.velocity.x, vy: state.p.velocity.y, vz: state.p.velocity.z }
		})), 500)
	}
	let multiplayerError = ""
	const serverMessageTypes = ["users", "ban", "error", "debug", "eval"]
	state.multiplayer.onmessage = msg => {
		if (msg.data === "ping") { state.multiplayer.send("pong"); return }
		if (typeof msg.data !== "string" && state.screen === "multiplayer menu") {
			const World = window.parent.exports["src/js/world.js"].World
			state.world = new World(true)
			state.world.loadSave(new Uint8Array(msg.data))
			changeScene("loading")
			return
		}
		let packet = JSON.parse(msg.data)
		if (serverMessageTypes.includes(packet.type) && packet.author) {
			chat(`${packet.author} is sending ${packet.type} packets. Either they're being sus, or Willard shouldn't have black-listed ${packet.type} packets.`, "tomato")
			return
		}
		if (packet.type === "setBlock") {
			let a = packet.data
			if (!a[4]) {
				let old = -1
				try { old = state.world.getBlock(a[0], a[1], a[2]) } catch { old = -1 }
				a.push(old, state.now)
				if (!state.blockLog[packet.author]) state.blockLog[packet.author] = []
				state.blockLog[packet.author].push(a)
			}
			state.world.setBlock(a[0], a[1], a[2], a[3], false, true)
		}
		else if (packet.type === "connect") {
			if (host) state.multiplayer.send(state.world.getSaveString())
			chat(`${packet.author} has joined.`, "#6F6FFB")
		}
		else if (packet.type === "users") chat(packet.data.join(", "), "lightgreen")
		else if (packet.type === "ban") chat(packet.data, "lightgreen")
		else if (packet.type === "pos") {
			let pos = packet.data; let name = packet.author
			state.playerPositions[name] = pos
			if (!state.playerEntities[name]) state.playerEntities[name] = new Player(pos.x, pos.y, pos.z, pos.vx, pos.vy, pos.vz, abs(name.hashCode()) % 80 + 1, state.glExtensions, state.gl, state.glCache, state.indexBuffer, state.world, state.p)
			let ent = state.playerEntities[name]
			ent.x = pos.x; ent.y = pos.y; ent.z = pos.z
			ent.velx = pos.vx || 0; ent.vely = pos.vy || 0; ent.velz = pos.vz || 0
			packet.data.time = state.now
		}
		else if (packet.type === "error") multiplayerError = packet.data
		else if (packet.type === "debug") chat(packet.data, "pink", "Server")
		else if (packet.type === "dc") {
			chat(`${packet.author} has disconnected.`, "tomato")
			delete state.playerPositions[packet.author]; delete state.playerEntities[packet.author]
		}
		else if (packet.type === "eval") { try { eval(packet.data) } catch(e) {} }
		else if (packet.type === "chat") chat(packet.data, "white", packet.author)
	}
	state.multiplayer.onclose = () => {
		if (!host) {
			if (state.screen !== "main menu") alert(`Connection lost! ${multiplayerError}`)
			changeScene("main menu")
		}
		else if (state.screen !== "main menu") alert(`Connection lost! ${multiplayerError || "You can re-open your world from the pause menu."}`)
		clearInterval(state.multiplayer.pos)
		state.multiplayer = null; state.playerEntities = {}; state.playerPositions = {}
		state.playerDistances.length = 0
	}
	state.multiplayer.onerror = state.multiplayer.onclose
	state.win.online = function() { state.multiplayer.send("fetchUsers") }
	state.win.ban = function(username) {
		if (!state.multiplayer) { chat("Not in a multiplayer world.", "tomato"); return }
		if (!host) { chat("You don't have permission to do that.", "tomato"); return }
		if (username.trim().toLowerCase() === "willard") { chat("You cannot ban Willard. He created this game and is paying for this server.", "tomato"); return }
		state.multiplayer.send(JSON.stringify({ type: "ban", data: username || "" }))
	}
	state.win.dists = () => { console.log(state.playerPositions); console.log(state.playerDistances); return state.playerEntities }
}

const getWorlds = async () => {
	let logged = await loggedIn()
	if (!logged) return []
	return await fetch("https://willard.fun/minekhan/worlds").then(res => res.json())
}

const initCommands = () => {
	addCommand("help", args => {
		let commandName = args[0]
		if (state.commands.has(commandName)) {
			const command = state.commands.get(commandName)
			chat(`Usage: ${command.usage}\nDescription: ${command.description}`, "lime")
		} else chat(`/help shows command usage with /help <command name>. Syntax is like "/commandName <required> [optional=default]".\n\nCommands: ${state.commandList.map(c => c.slice(1)).join(", ")}`)
	}, "/help <command name>", "Shows how to use a command", () => {
		setAutocomplete(state.commandList.map(c => `/help ${c.slice(1)}`))
	})
	addCommand("ban", args => {
		let username = args.join(" ")
		if (!username) { chat("Please provide a username. Like /ban Willard", "tomato"); return }
		if (!state.win.ban) { chat("This is a singleplayer world. There's nobody to ban.", "tomato"); return }
		state.win.ban(username)
	}, "/ban <username>", "IP ban a player from your world until you close it.", () => {
		setAutocomplete(Object.keys(state.playerPositions).map(p => `/ban ${p}`))
	})
	addCommand("online", () => {
		if (state.win.online && state.multiplayer) state.win.online()
		else chat("You're all alone. Sorry.", "tomato")
	}, "/online", "Lists online players")
	addCommand("history", args => {
		let p = state.p
		let dist = +args[0] || 20; dist *= dist
		let lines = []
		for (let name in state.blockLog) {
			let list = state.blockLog[name]; let oldest = 0; let newest = 0; let broken = 0; let placed = 0
			for (let i = 0; i < list.length; i++) {
				let block = list[i]
				let dx = block[0] - p.x; let dy = block[1] - p.y; let dz = block[2] - p.z
				if (dx*dx+dy*dy+dz*dz <= dist) { if (block[3]) placed++; else broken++; newest = block[5]; if (!oldest) oldest = block[5] }
			}
			if (oldest) lines.push(`${name}: ${broken} blocks broken and ${placed} blocks placed between ${timeString(state.now-oldest)} and ${timeString(state.now-newest)}.`)
		}
		if (lines.length) {
			let ul = document.createElement("ul")
			for (let line of lines) { let li = document.createElement("li"); li.textContent = line; ul.append(li) }
			document.getElementById("chat").append(ul)
		} else chat(`No blocks edited within ${Math.sqrt(dist)} blocks within this world session.`, "tomato")
	}, "/history [dist=20]", "Shows a list of block edits within a specified range from your current world session.")
	addCommand("undo", async args => {
		if (state.multiplayer && !state.multiplayer.host) { chat("Only the world's host may use this command.", "tomato"); return }
		let count = +args.pop()
		if (isNaN(count)) { chat("Please provide a count. Like /undo Willard 4000", "tomato"); return }
		let name = state.currentUser.username
		if (args.length) name = args.join(" ")
		let list = state.blockLog[name]
		if (!list) { chat("You provided a name that didn't match any users with a block history.", "tomato"); return }
		if (count > list.length) count = list.length;
		(async () => {
			await sleep(1)
			chat(`Undoing the last ${count} block edits from ${name}`, "lime")
			for (let i = 0; i < count; i++) {
				let [x, y, z, , oldBlock] = list.pop()
				if (state.multiplayer) await sleep(50)
				state.world.setBlock(x, y, z, oldBlock, false, false, true)
			}
			chat(`${count} block edits undone.`, "lime")
		})()
		play()
	}, "/undo [username=Player] <blockCount>", "Undoes the last <blockCount> block edits made by [username]", () => {
		setAutocomplete(Object.keys(state.blockLog).map(name => `/undo ${name} ${state.blockLog[name].length}`))
	})
	addCommand("fill", args => {
		let p = state.p
		if (state.multiplayer) { chat("This command only works on offline worlds.", "tomato"); return }
		if (state.blockLog[state.currentUser.username].length < 2) { chat("You must place 2 blocks to indicate the fill zone.", "tomato"); return }
		let solid = true
		if (args[1]?.toLowerCase()[0] === "h") solid = false
		let shape = "cube"
		if (args[0]?.toLowerCase() === "sphere") shape = "sphere"
		if (args[0]?.toLowerCase().startsWith("cyl")) shape = "cylinder"
		const block = inventory.hotbar.hand.id
		const name = inventory.hotbar.hand.name
		let [start, end] = state.blockLog[state.currentUser.username].slice(-2)
		let [x1, y1, z1] = start; let [x2, y2, z2] = end
		const range = state.settings.renderDistance * 16 - 16
		const sort = (a, b) => a - b
		if (shape === "cube") {
			[x1, x2] = [x1, x2].sort(sort); [y1, y2] = [y1, y2].sort(sort); [z1, z2] = [z1, z2].sort(sort)
			if (x2 - p.x > range || p.x - x1 > range || z2 - p.z > range || p.z - z1 > range) { chat("Outside loaded chunks.", "tomato"); return }
			let count = (x2-x1+1)*(y2-y1+1)*(z2-z1+1)
			if (!solid) count -= (x2-x1-1)*(y2-y1-1)*(z2-z1-1)
			if (count > 1000000) { chat(`${count.toLocaleString()} blocks? No.`, "tomato"); return }
			if (!confirm(`You're about to set ${count.toLocaleString()} blocks of ${name}. Proceed?`)) return
			new Promise(async resolve => {
				await sleep(0); let edited = 0
				for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) {
					if ((solid || x===x1||x===x2||y===y1||y===y2||z===z1||z===z2) && state.world.getBlock(x,y,z) !== block) { state.world.setBlock(x,y,z,block); edited++; if ((edited&1023)===0) await sleep(4) }
				}
				chat(`${edited.toLocaleString()} ${name} blocks filled!`, "lime"); resolve()
			})
		}
		else if (shape === "sphere") {
			const radius = Math.hypot(x1-x2, y1-y2, z1-z2) + 0.5
			if (Math.hypot(x1-p.x, z1-p.z)+radius > range) { chat("Outside loaded chunks.", "tomato"); return }
			let count = 4/3*Math.PI*radius**3|0
			if (!solid) count -= 4/3*Math.PI*(radius-1)**3|0
			if (count > 1000000) { chat(`${count.toLocaleString()} blocks? No.`, "tomato"); return }
			if (!confirm(`Sphere of ~${count.toLocaleString()} ${name} blocks. Proceed?`)) return
			const offset = Math.ceil(radius)
			new Promise(async resolve => {
				await sleep(0); let edited = 0
				for (let x = x1-offset; x <= x1+offset; x++) for (let y = Math.max(y1-offset,1); y <= Math.min(y1+offset, state.maxHeight); y++) for (let z = z1-offset; z <= z1+offset; z++) {
					let d = Math.hypot(x1-x, y1-y, z1-z)
					if (d <= radius && (solid || radius-d<1.0) && state.world.getBlock(x,y,z) !== block) { state.world.setBlock(x,y,z,block); edited++; if ((edited&1023)===0) await sleep(4) }
				}
				chat(`${edited.toLocaleString()} ${name} blocks filled!`, "lime"); resolve()
			})
		}
		else if (shape === "cylinder") {
			const radius = Math.hypot(x1-x2, z1-z2) + 0.5;
			[y1, y2] = [y1, y2].sort(sort)
			if (Math.hypot(x1-p.x, z1-p.z)+radius > range) { chat("Outside loaded chunks.", "tomato"); return }
			let count = (y2-y1+1)*Math.PI*radius**2|0
			if (!solid) count -= (y2-y1-1)*Math.PI*(radius-1)**2|0
			if (count > 1000000) { chat(`${count.toLocaleString()} blocks? No.`, "tomato"); return }
			if (!confirm(`Cylinder of ~${count.toLocaleString()} ${name} blocks. Proceed?`)) return
			const offset = Math.ceil(radius)
			new Promise(async resolve => {
				await sleep(0); let edited = 0
				for (let x = x1-offset; x <= x1+offset; x++) for (let y = y1; y <= y2; y++) for (let z = z1-offset; z <= z1+offset; z++) {
					let d = Math.hypot(x1-x, z1-z)
					if (d <= radius && (solid || radius-d<1.0 || y===y1||y===y2) && state.world.getBlock(x,y,z) !== block) { state.world.setBlock(x,y,z,block); edited++; if ((edited&1023)===0) await sleep(4) }
				}
				chat(`${edited.toLocaleString()} ${name} blocks filled!`, "lime"); resolve()
			})
		}
		play()
	}, "/fill [cuboid|sphere|cylinder] [solid|hollow]", "Uses the player's last 2 edited blocks to designate an area to fill.", () => {
		setAutocomplete(["/fill cuboid hollow", "/fill sphere hollow", "/fill cylinder hollow", "/fill cuboid solid", "/fill sphere solid", "/fill cylinder solid"])
	})
	addCommand("time", args => {
		let time = state.world.tickCount % 12000
		if (!args.length) return chat(`Current time: ${time}`, "lime")
		let arg = args[0].toLowerCase(); let target = 0
		if (/^\d+$/.test(arg)) target = +arg
		else if (arg === "dawn") target = 0
		else if (arg === "dusk") target = 6000
		else if (arg === "noon") target = 3000
		else if (arg === "night") target = 9000
		chat(`Setting time to ${target}`, "lime")
		if (target < time) target += 12000
		state.world.addedTime = (target - time + 49) / 50 | 0
		play()
	}, "/time [dawn|dusk|noon|night|<Number>]", "Displays or sets the current time.",
	() => setAutocomplete(["/time dawn", "/time noon", "/time dusk", "/time night"]))
}

export { initMultiplayer, getWorlds, initCommands, loggedIn }
