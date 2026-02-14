// chat.js - Chat display, alerts, and command system
import { state, text, textSize } from '../state.js'

const { max } = Math

const chat = (msg, color, author) => {
	let chatOutput = document.getElementById("chat")
	let lockScroll = false
	if (chatOutput.scrollTop + chatOutput.clientHeight + 50 > chatOutput.scrollHeight) {
		lockScroll = true
	}
	let div = document.createElement("div")
	div.className = "message"
	let content = document.createElement('span')
	if (color) content.style.color = color
	content.textContent = msg
	if (author) {
		let name = document.createElement('span')
		name.textContent = author + ": "
		if (author === "Willard") name.style.color = "cyan"
		div.append(name)
		msg = `${author}: ${msg}`
	}
	div.append(content)
	chatOutput.append(div)
	chatAlert(msg)
	if (lockScroll) chatOutput.scroll(0, 10000000)
}

const sendChat = (msg) => {
	if (state.multiplayer) {
		state.multiplayer.send(JSON.stringify({ type: "chat", data: msg }))
	}
	chat(`${state.currentUser.username}: ${msg}`, "lightgray")
}

const chatAlert = (msg) => {
	if (state.screen !== "play") return
	state.alerts.push({ msg: msg.substr(0, 50), created: state.now, rendered: false })
	if (state.alerts.length > 5) state.alerts.shift()
	renderChatAlerts()
}

const renderChatAlerts = () => {
	if (!state.alerts.length || state.screen !== "play") return
	let y = state.height - 150
	if (state.now - state.alerts[0].created > 10000 || !state.alerts.at(-1).rendered) {
		let x = 50
		let y2 = y - 50 * (state.alerts.length - 1) - 20
		let w = state.charWidth * state.alerts.reduce((mx, al) => max(mx, al.msg.length), 0)
		let h = 50 * (state.alerts.length - 1) + 24
		state.ctx.clearRect(x, y2, w + 5, h + 5)
	} else return
	while (state.alerts.length && state.now - state.alerts[0].created > 10000) {
		state.alerts.shift()
	}
	textSize(20)
	for (let i = state.alerts.length - 1; i >= 0; i--) {
		text(state.alerts[i].msg, 50, y)
		y -= 50
	}
}

const setAutocomplete = (list) => {
	if (list === state.autocompleteList) return
	if (list.length === state.autocompleteList.length) {
		let i = 0
		for (; i < list.length; i++) {
			if (list[i] !== state.autocompleteList[i]) break
		}
		if (i === list.length) return
	}
	let element = document.getElementById("commands")
	while (element.childElementCount) element.removeChild(element.lastChild)
	for (let string of list) {
		let option = document.createElement("option")
		option.value = string
		element.append(option)
	}
	state.autocompleteList = list
}

const addCommand = (name, callback, usage, description, autocomplete) => {
	if (!autocomplete) autocomplete = () => {}
	state.commands.set(name, { name, callback, usage, description, autocomplete })
	state.commandList.push("/" + name)
}

const sendCommand = (msg) => {
	msg = msg.substr(1)
	let parts = msg.split(" ")
	let cmd = parts.shift()
	if (state.commands.has(cmd)) {
		state.commands.get(cmd).callback(parts)
	}
	setAutocomplete(state.commandList)
}

export { chat, sendChat, chatAlert, renderChatAlerts, setAutocomplete, addCommand, sendCommand }
